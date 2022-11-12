# parcel-transformer-transcrypt
### A Python to JavaScript transformer for Parcel v2 using the Transcrypt transpiler

If you find a problem with this Parcel transformer, please [submit an issue on GitHub](https://github.com/JennaSys/parcel-transformer-transcrypt/issues) and help make it better.

If you just have a question about how to use it, you can also post a message in [GitHub discussions](https://github.com/JennaSys/parcel-transformer-transcrypt/discussions/4).

### Installation
This Parcel transformer can be installed with npm or yarn:
```bash
npm install parcel-transformer-transcrypt --save-dev
```

To get the latest unpublished version, you can also install it directly from the GitHub repository:
```bash
npm install https://github.com/JennaSys/parcel-transformer-transcrypt --save-dev
```

### Dependencies
Obviously Parcel v2 must be installed:

```bash
npm install parcel -D
```
This plugin also requires installation of the [Transcrypt](https://www.transcrypt.org) transpiler.  In order for Transcrypt to properly parse the AST of your Python code, the version of Python you use with Transcrypt must match the version of Transcrypt it was designed for.

It is recommended to install Transcrypt into a virtual environment for your project.  This can be accomplished with the following commands:

For Python 3.9:  
```bash
python3.9 -m venv venv
. ./venv/bin/activate
python -m pip install transcrypt
```

For Python 3.7:  
```bash
python3.7 -m venv venv
. ./venv/bin/activate
python -m pip install transcrypt==3.7.16
```

Note that when run, before the build process starts, this transformer will automatically detect the version of Python and Transcrypt being used by running the following commands in the background:
- `python --version`
- `transcrypt --help`

To bypass this auto-detect behavior, you can explicitly specify the Transcrypt version in the _package.json_ file as indicated in the next section.

### Configuration

You will need to create a _.parcelrc_ file in the same folder as the _package.json_ file to let Parcel know how to handle the Python files:

_.parcelrc_
```json
{
  "extends": ["@parcel/config-default"],
  "transformers": {
    "*.py": ["parcel-transformer-transcrypt"]
  }
}
```

To override the default settings for Transcrypt, you can add a `"parcel-transformer-transcrypt"` key to the _package.json_ file with the desired [CLI configuration](https://www.transcrypt.org/docs/html/installation_use.html#available-command-line-switches) information:
```json
  "parcel-transformer-transcrypt": {
    "transcryptVersion": "3.9",
    "watchAllFiles": true,
    "command": "python -m transcrypt",
    "arguments": [
      "--nomin",
      "--map",
      "--verbose"
    ]
  }
```
The `"transcryptVersion"`, `"watchAllFiles"`, `"command"`, and `"arguments"` keys are all optional.  Default values will be used if not supplied.

If the `watchAllFiles` key is missing or set to `true`, all Python files that are processed by Transcrypt will be added to Parcel's file watch.  If this key is set to `false`, only the initial entry point file will be watched.

Transcrypt normally puts the files it generates in a folder called `__target__` that is created in the same folder as the source files you are processing. This default behavior may not be desired in many cases.

If you are using Transcrypt 3.9 however, this Parcel transformer will put Transcrypt's generated files in a folder named `.build` that will be created in the root folder of the project (where the _package.json_ file resides and where you run `npm` commands from).
You can override the location of this build folder by adding an argument to the configuration as shown above:
```json
    "arguments": [
      "--nomin",
      "--map",
      "--outdir src/__target__"  
    ]
```
The output folder you specify in the arguments should be relative to the project root folder.  

_Note that the `--outdir` directive is not valid for Transcrypt version 3.7 and will be ignored in that case._

You can also set up build scripts in the _package.json_ file for Parcel that might look similar to this:
```json
  "scripts": {
    "start": "NODE_ENV=development parcel --log-level info src/index.html --dist-dir dist/dev --port 8080",
    "build": "NODE_ENV=production parcel build --log-level info src/index.html --no-source-maps --dist-dir dist/prod --no-cache"
  }
```
The `npm start` script would run Parcel in development mode that starts up a development web server and watches source files for changes.

The `npm run build` script builds the application for production then exits. 


### FAQ
- **_What does this Parcel plugin do?_**  
  Instead of having to run Transcrypt manually and then use those generated JavaScript files as the input to what you want to bundle with Parcel, you can just run Parcel and it will run Transcrypt for you when it sees a file with a .py file extension.
  
  For example, if Parcel sees a Python file specified as the `src` in an HTML script tag, it will have Transcrypt generate the Javascript file and then automatically update the HTML script tag with the name of the generated JavaScript file. 
  
  As a bonus, anytime you make a change to one of your Python files while Parcel has it's development server running in "watch" mode, your updated Python files will automatically be re-transpiled by Transcrypt.
- **_How does this plugin compare to the one for Parcel v1?_**  
  _It is very similar:_
  - It mostly works seamlessly with the default configuration
  - It installs as a JavaScript development dependency
  - The configuration can be customized by adding entries to _package.json_

  _But there are also a few differences:_
  - The output folder is configurable
  - Parcel file watch works on _all_ transpiled Python files in development mode and not just the entry point
  - It doesn't need to be patched before using it :-)
- **_What if I don't want to use Transcrypt?_**  
  Then you will have to use a different Parcel transformer for Python other than this one.  It is a hard dependency.


### Notes
This has been tested with:
- Linux Mint 19/Ubuntu 18
- Windows 10
- macOS Monterey
- Python/Transcrypt version 3.7 & 3.9
- Node versions 14, 15, 16
- npm versions 6, 7, 8
- parcel versions 2.2, 2.4


If you are using Linux and start getting errors stating *"No space left on device"*, see the Parcel website for [how to fix it](https://parceljs.org/features/development/#linux%3A-no-space-left-on-device).

