const child_process = require("child_process");


// Guess Python command from command string
const getPythonCommand = (command) => {
    if (command) {
        mainCommand = command.split(' ');
        if (mainCommand.length > 0 && mainCommand[0].includes('python')) {
            return mainCommand[0]
        }
    }
    return "python"
}

// Guess Transcrypt command from command string
const getTranscryptCommand = (command) => {
    if (command) {
        if (!command.includes('transcrypt')) {
            return null
        }

        mainCommand = command.split(' ');
        if (mainCommand.length > 0) {
            if (mainCommand[0].endsWith('transcrypt')) {
                return mainCommand[0]
            }
            if (mainCommand[0].includes('python')) {
                return `${mainCommand[0]} -m transcrypt`
            }
        }
        return "transcrypt"
    }
    return null
}

// Extract version by running base command and examining stdout
const _getVersion = (command) => {
    //  Match value on: Python n.nn.nn -> Return just major.minor part of semver
    let re = /[Pp]ython (\d\.\d{1,2})\.\d{1,2}/g;  // Assume regex for Python output
    if (command.includes('transcrypt')) {
        //  Match value on: Transcrypt *Version n.nn.nn -> Return just major.minor part of semver
        re = /[Tt]ranscrypt .*[Vv]ersion (\d\.\d{1,2})\.\d{1,2}/g;
    }
    try {
        // console.log(`exec: ${command}`)
        let stdout = child_process.execSync(command, {'encoding': 'utf8', 'windowsHide': true}).toString();
        const matches = stdout.matchAll(re);
        if (matches) {
            version = Array.from(matches, m => m[1]);
            if (version.length > 0) {
                return version[0]
            }
        }
    } catch (error) {
        if (error.stderr.includes("No module named transcrypt")) {
            return "0.0"  // Transcrypt not installed
        }
        console.log(`There was a problem running the command: '${command}'`);
    }
    return null
}

// Entry point to module (type var is "python" or "transcrypt)"
const getVersion = (command, type) => {
    let cmd;
    let arg;
    if (type.toLowerCase().startsWith('t')) {
        cmd = getTranscryptCommand(command);
        arg = "--help"
    }
    else if (type.toLowerCase().startsWith('p')) {
        cmd = getPythonCommand(command);
        arg = "--version"
    }
    if (cmd) {
        return _getVersion(`${cmd} ${arg}`);
    }
    return null;
}

exports.getVersion = getVersion;


// const main = () => {
//     const commands = [null, "", "trans", "transcrypt", "python -m transcrypt", "python3 -m transcrypt", "python3.7 -m transcrypt", "python3.9 -m transcrypt", "/usr/bin/python3.9 -m transcrypt"]
//
//     commands.map((cmd) => {
//         console.log(getPythonCommand(cmd));
//     })
//     console.log()
//     commands.map((cmd) => {
//         console.log("P", getVersion(cmd, 'Python'));
//     })
//     console.log()
//     commands.map((cmd) => {
//         console.log("T", getVersion(cmd, 'Transcrypt'));
//     })
// }
//
// main();  // Testing
