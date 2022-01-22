const {Transformer} = require('@parcel/plugin');
const {relativeUrl} = require('@parcel/utils');
const child_process = require("child_process");
const path = require("path");
const fs = require('fs')


// This Python transformer was built on the shoulders of the original parcel-plugin-transcrypt package
// for Parcel V1, and we recognize the efforts of those that have come before us


const PACKAGE_KEY = 'parcel-transformer-transcrypt';

// Note that the Transcrypt output folder should be specified relative to the project root.
const OUTPUT_DIR = '.build'

// Below is the default configuration for the plugin. To customize how transcrypt is
// run, copy this dictionary into your project's package.json, then modify as needed.
// (Note that the comments will need to be removed since they are not valid JSON)
const DEFAULT_PACKAGE_CONFIG = {
    "parcel-transformer-transcrypt": {
        "command": "python -m transcrypt",
        "arguments": [
            /*  note that --build should normally not be used because multiple .py entry points         */
            /*  cause transcrypt to delete the first run's __target__ as it starts the second call.     */

            /*  parcel does minifying, so tell transcrypt to back off.                                  */
            "--nomin",
            /*  parcel expects to read these (if production build, it discards them at bundle time).    */
            "--map",
            /*  make transcrypt chatty so error messages are more useful                                */
            "--verbose"
        ]
    }
};

const getTranscryptProjectInfo = (projectFile) => {
    if (fs.existsSync(projectFile)) {
        try {
            return JSON.parse(fs.readFileSync(projectFile, 'utf8'));
        } catch (error) {
            console.log(`Unable to read transcrypt project file for watch mode: ${error}`);
        }
    }
    return {};
};

exports.default = new Transformer({
    async loadConfig({config}) {
        // load custom Transcrypt config (under the package key in package.json)
        const packageConfig = await config.getConfig(['package.json']);
        if (packageConfig && packageConfig.contents[PACKAGE_KEY]) {
            return packageConfig.contents[PACKAGE_KEY];
        }
        return null;  // Config override was not found, default config will be used
    },

    async transform({asset, config, logger, options}) {
        const pkgConfig = config ?? {};  // this could be partial or empty
        // logger.warn({message: `pkgConfig: ${JSON.stringify(pkgConfig, null, 4)}\n`});

        const fileInfo = path.parse(asset.filePath);
        const projectRoot = options.projectRoot;
        const sourceFile = relativeUrl(
            projectRoot,
            asset.filePath,
        );

        // Prepare Transcrypt CLI options
        let transcryptConfig = DEFAULT_PACKAGE_CONFIG[PACKAGE_KEY];

        // Add Transcrypt output folder to default config
        let outdir = relativeUrl(
            fileInfo.dir,
            path.join(projectRoot, OUTPUT_DIR)  //transcrypt default output folder
        );
        let defaultArgs = transcryptConfig['arguments'];
        defaultArgs.push(`--outdir ${outdir}`);
        transcryptConfig = {...transcryptConfig, arguments: defaultArgs};
        // logger.warn({message: `defaultConfig: ${JSON.stringify(transcryptConfig, null, 4)}\n`});

        //Incorporate any transcrypt config existing in package.json
        let pkgCommand = pkgConfig['command'];
        if (pkgCommand) {
            if (!pkgCommand.includes('transcrypt')) {
                const msg1 = `Config 'command' key in ${PACKAGE_KEY} does not appear to be valid: '${pkgCommand}'`;
                const msg2 = `The value for ${PACKAGE_KEY}/command in package.json needs to be fixed.  Stopping build.`;
                throw new Error(`\n${msg1}\n${msg2}\n`)
            }
            transcryptConfig = {...transcryptConfig, command: pkgCommand};
        }

        let pkgArgs = pkgConfig['arguments'];
        if (pkgArgs) {
            const pkgOutdir = pkgArgs.filter(arg => arg.startsWith('--outdir '));
            if (pkgOutdir.length === 0) {
                // outdir was not supplied so use default
                pkgArgs.push(`--outdir ${outdir}`);
            } else {
                // outdir is relative to project root so calculate what that is...
                pkgArgs = pkgArgs.filter(arg => !arg.startsWith('--outdir '));  // Remove config outdir from args
                const pkgdir = pkgOutdir[0].replace('--outdir ', '').trim();  // Get the value only
                outdir = relativeUrl(
                    fileInfo.dir,
                    path.join(projectRoot, pkgdir)
                );
                pkgArgs.push(`--outdir ${outdir}`);  // Put the relative outdir back into args
            }
            transcryptConfig = {...transcryptConfig, arguments: pkgArgs};
        }
        // logger.warn({message: `finalConfig:\n${JSON.stringify(transcryptConfig, null, 4)}\n`});

        // Make sure that transcrypt won't kill the source files
        const absoluteOutdir = path.resolve(path.join(fileInfo.dir, outdir));
        if (absoluteOutdir === fileInfo.dir) {
            const msg1 = "Transcrypt output folder can not be the same as the source file folder!";
            const msg2 = `--Transcrypt output folder: ${absoluteOutdir}`;
            const msg3 = `--Source folder:            ${fileInfo.dir}`;
            const msg4 = "\nContinuing could cause a loss of source content so stopping build.";
            const msg5 = "(Try configuring a different Transcrypt output folder in package.json.)"
            throw new Error(`\n${msg1}\n${msg2}\n${msg3}\n${msg4}\n${msg5}\n`)
        }

        // Prepare transcrypt CLI command
        const cmd = [
            transcryptConfig['command'],        // python3 -m transcrypt
            ...transcryptConfig['arguments'],   // --map --nomin --build ...
            sourceFile                      // the file to transpile
        ].join(' ');
        logger.info({message: `${cmd}\n`});

        // Make sure Transcrypt is called from the root project dir so the __target__ location
        // stays the same for all .py files in the run.
        const cmd_options = {'cwd': projectRoot, 'encoding': 'utf8',};

        // And now time for the Transcrypt magic to happen!
        try {
            let stdout = child_process.execSync(cmd, cmd_options).toString();
            logger.info({message: stdout});
            logger.info({message: "Transcrypt build complete!\n"});
        } catch (error) {
            logger.error({message: error.stdout.toString()});
            // logger.error(error.message);
            throw new Error(`\n${error.message}\n`)
        }

        // If in dev mode, get the Transcrypt Python module list and add
        // each Python file that was processed to Parcel watched files
        if (options.mode === 'development') {
            const runInfoFile = path.join(absoluteOutdir, fileInfo.name) + '.project';
            const runInfo = getTranscryptProjectInfo(runInfoFile)
            if (runInfo.hasOwnProperty('modules')) {
                const modules = runInfo['modules'];
                const onlySourceModules = modules.filter(module => !module['source'].endsWith('__runtime__.py'))
                onlySourceModules.forEach((module) => {
                    const absoluteModulePath = path.join(projectRoot, module['source'])
                    asset.invalidateOnFileChange(absoluteModulePath)
                    // logger.info({message: `Watching file '${absoluteModulePath}'`});
                });
            } else {
                const msg1 = `\nUnable to load Transcrypt project file after build: '${runInfoFile}'`;
                const msg2 = "WARNING: Source files were not added to Parcel watch.";
                logger.warn({message: `${msg1}\n${msg2}`});
            }
        }

        // Rather than read in and pass back the generated JavaScript, we just add
        // a JS export here that points to the target file. For reference, this is
        // the same approach that the Parcel V1 transcrypt plugin used.
        let importPath = path.join(outdir, fileInfo.name) + '.js';
        if (!importPath.startsWith('..' + path.sep)) {
            importPath = '.' + path.sep + importPath
        }
        // logger.warn({message: `importPath: ${importPath}`});

        // And finally we send it back to Parcel to bundle
        const code = `export * from "${importPath}";`;
        asset.setCode(code);
        // asset.setMap(map);
        asset.type = "js";

        // Return the asset
        return [asset];
    }
});

