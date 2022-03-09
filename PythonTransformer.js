const {Transformer} = require('@parcel/plugin');
const {relativeUrl} = require('@parcel/utils');
const child_process = require("child_process");
const path = require('path');
const fs = require('fs');

const {getVersion} = require('./versionUtil')


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
        "transcryptVersion": "3.9",
        "watchAllFiles": true,
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

// Get the versions of Python and Transcrypt being used
const validateVersions = (command) => {
    const pythonVersion = getVersion(command, "python");
    const transcryptVersion = getVersion(command, "transcrypt");
    // console.log('Python Version:', pythonVersion);
    // console.log('Transcrypt Version:', transcryptVersion);

    if (transcryptVersion === null) {
        throw new Error(`Transcrypt command '${command}' is not valid. Stopping build.`);
    }

    if (transcryptVersion === '0.0') {
        const msg1 = "Transcrypt does not appear to be installed. Stopping build.";
        const msg2 = "The Transcrypt Python transpiler can be installed using: 'pip install transcrypt'";
        const msg3 = "If your are using a Python virtual environment, make sure it is activated before starting the build process";
        throw new Error(`\n${msg1}\n${msg2}\n${msg3}\n`);
    }

    if (pythonVersion !== transcryptVersion) {
        throw new Error(`Transcrypt version '${transcryptVersion}' does not match Python version '${pythonVersion}' that is being used. Stopping build.`);
    }

    return transcryptVersion;
}

// Read the generated Transcrypt project file
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

//This is what we are here for...
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

        //Use transcrypt command config if it exists in package.json
        let pkgCommand = pkgConfig['command'];
        if (pkgCommand) {
            logger.warn({message: "Using transcrypt command from package.json..."});
            if (!pkgCommand.includes('transcrypt')) {
                const msg1 = `Config 'command' key in ${PACKAGE_KEY} does not appear to be valid: '${pkgCommand}'`;
                const msg2 = `The value for ${PACKAGE_KEY}/command in package.json needs to be fixed.  Stopping build.`;
                throw new Error(`\n${msg1}\n${msg2}\n`)
            }
            transcryptConfig = {...transcryptConfig, command: pkgCommand};
        }

        // Deal with transcrypt version issues
        let transcryptVersion;
        let pkgVersion = pkgConfig['transcryptVersion'];
        if (pkgVersion) {
            //  Match semver value on: 3.nn or 3.nn.nn -> Return just major.minor part of semver
            const re = /(^3\.\d{1,2})(?:\.\d{1,2})?$/g;
            matches = pkgVersion.matchAll(re);
            if (matches) {
                version = Array.from(matches, m => m[1]);
                if (version.length > 0) {
                    logger.warn({message: `Use of Transcrypt version '${version[0]}' as specified in package.json file will be assumed.`});
                    transcryptVersion = version[0];
                }
            }
            if (!transcryptVersion) {
                logger.warn({message: `Transcrypt version '${pkgVersion}' specified in package.json file is invalid and will be ignored.`});
            }
        }
        if (!transcryptVersion) {
            transcryptVersion = validateVersions(transcryptConfig['command']);
            logger.warn({message: `Detected Transcrypt version ${transcryptVersion}`});
        }
        // logger.info({message: `Using Transcrypt version ${transcryptVersion}`});

        // Figure out what the default output folder should be for transcrypt
        let outdir;
        if (transcryptVersion === '3.7') {
            outdir = relativeUrl(
                fileInfo.dir,
                path.join(fileInfo.dir, '__target__')  //transcrypt default output folder
            );
        } else {
            // Add Transcrypt output folder to default config
            outdir = relativeUrl(
                fileInfo.dir,
                path.join(projectRoot, OUTPUT_DIR)
            );
            let defaultArgs = transcryptConfig['arguments'];
            defaultArgs.push(`--outdir ${outdir}`);
            transcryptConfig = {...transcryptConfig, arguments: defaultArgs};
        }

        let pkgArgs = pkgConfig['arguments'];
        if (pkgArgs) {
            logger.warn({message: "Using transcrypt args from package.json..."});
            const pkgOutdir = pkgArgs.filter(arg => arg.startsWith('--outdir '));
            if (pkgOutdir.length === 0) {
                if (transcryptVersion !== '3.7') {
                    pkgArgs.push(`--outdir ${outdir}`);  // outdir was not supplied so use default
                }
            } else {
                // outdir is relative to project root so calculate what that is...
                pkgArgs = pkgArgs.filter(arg => !arg.startsWith('--outdir '));  // Remove config outdir from args
                if (transcryptVersion !== '3.7') {
                    const pkgdir = pkgOutdir[0].replace('--outdir ', '').trim();  // Get the value only
                    outdir = relativeUrl(
                        fileInfo.dir,
                        path.join(projectRoot, pkgdir)
                    );
                    pkgArgs.push(`--outdir ${outdir}`);  // Put the relative outdir back into args
                } else {
                    logger.warn({message: "Argument '--outdir' is not valid with Transcrypt version 3.7 and will be ignored."});
                }
            }
            transcryptConfig = {...transcryptConfig, arguments: pkgArgs};
        }
        // logger.warn({message: `finalConfig:\n${JSON.stringify(transcryptConfig, null, 4)}\n`});

        // Make sure that transcrypt won't kill the source files
        const absoluteOutdir = path.resolve(path.join(fileInfo.dir, outdir));
        if (absoluteOutdir === fileInfo.dir || absoluteOutdir === projectRoot) {
            const msg1 = "Transcrypt output folder can not be the same as the project root or the source file folder!";
            const msg2 = `--Transcrypt output folder: ${absoluteOutdir}`;
            const msg3 = `--Source folder:            ${fileInfo.dir}`;
            const msg4 = `--Project root:             ${projectRoot}`;
            const msg5 = "\nContinuing could cause a loss of source content so stopping build.";
            const msg6 = "(Try configuring a different Transcrypt output folder in package.json.)"
            throw new Error(`\n${msg1}\n${msg2}\n${msg3}\n${msg4}\n${msg5}\n${msg6}\n`)
        }

        // Prepare transcrypt CLI command
        const cmd = [
            transcryptConfig['command'],        // python3 -m transcrypt
            ...transcryptConfig['arguments'],   // --map --nomin --build ...
            sourceFile                          // the file to transpile
        ].join(' ');
        logger.info({message: `${cmd}\n`});

        // Make sure Transcrypt is called from the root project dir so the __target__ location
        // stays the same for all .py files in the run.
        const cmd_options = {'cwd': projectRoot, 'encoding': 'utf8',};

        // And it is now time for the Transcrypt magic to happen!
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
        // each Python file that was processed to the Parcel watched files
        if (options.mode === 'development') {
            let watchFiles = pkgConfig['watchAllFiles'];
            if (watchFiles === undefined || watchFiles) {
                const runInfoFile = path.join(absoluteOutdir, fileInfo.name) + '.project';
                const runInfo = getTranscryptProjectInfo(runInfoFile)
                if (runInfo.hasOwnProperty('modules')) {
                    const modules = runInfo['modules'];
                    const transcryptModules = path.join('site-packages', 'transcrypt');
                    const onlySourceModules = modules.filter(module => !module['source'].includes(transcryptModules))
                    onlySourceModules.forEach((module) => {
                        let absoluteModulePath = module['source'];
                        if (!path.isAbsolute(absoluteModulePath)) {
                            absoluteModulePath = path.join(projectRoot, module['source']);
                        }
                        asset.invalidateOnFileChange(absoluteModulePath)
                        // logger.info({message: `Watching file '${absoluteModulePath}'`});
                    });
                } else {
                    const msg1 = `\nUnable to load Transcrypt project file after build: '${runInfoFile}'`;
                    const msg2 = "WARNING: Source files were not added to Parcel watch.";
                    logger.warn({message: `${msg1}\n${msg2}`});
                }
            } else {
                logger.warn({message: `Skipping adding files to Parcel watch`});
            }
        }

        // Rather than read in and pass back the generated JavaScript code, we just add
        // a JS export here that points to the target file. For reference, this is the
        // same approach that the Parcel V1 transcrypt plugin used.
        let importPath = outdir + '/' + fileInfo.name + '.js';
        if (!importPath.startsWith('../')) {
            importPath = './' + importPath
        }

        // And finally we send it back to Parcel for bundling
        const code = `export * from "${importPath}";`;
        asset.setCode(code);
        // asset.setMap(map);
        asset.type = "js";

        // Return the asset
        return [asset];
    }
});
