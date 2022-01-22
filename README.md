# parcel-transformer-transcrypt
### A Python to JavaScript transformer for Parcel V2 using the Transcrypt transpiler
_Consider this Parcel transformer to be in beta mode and still a work in progress._    
**USE AT YOUR OWN RISK!**

But that said, if you try it out and find a problem with it, please [submit an issue on GitHub](https://github.com/JennaSys/parcel-transformer-transcrypt/issues) and help make it better.

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
Obviously Parcel V2 must be installed:

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

### Configuration
Set up your dev and build scripts to build your project in the _package.json_ file for the project.

Sample scripts in the _package.json_ file for Parcel might look similar to this:
```json
  "scripts": {
    "start": "NODE_ENV=development parcel --log-level info src/index.html --dist-dir dist/dev --port 8080",
    "build": "NODE_ENV=production parcel build --log-level info src/index.html --no-source-maps --dist-dir dist/prod --no-cache"
  }
```
You will also need to create a _.parcelrc_ file in the same folder as the _package.json_ file to let Parcel know how to handle the Python files:

_.parcelrc_
```json
{
  "extends": ["@parcel/config-default"],
  "transformers": {
    "*.py": ["parcel-transformer-transcrypt"]
  }
}
```

### FAQ
- What does this Parcel plugin do?
- How does this plugin compare to the one for Parcel V1?
- What if I don't want to use Transcrypt?


### Notes
This has been tested with Node version 16 and npm version 8 on Linux

If you are using Linux and start getting errors stating *"No space left on device"*, see the Parcel website for [how to fix it](https://parceljs.org/features/development/#linux%3A-no-space-left-on-device).

