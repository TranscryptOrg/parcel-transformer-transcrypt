# parcel-transformer-transcrypt
### A Python to JavaScript transformer for Parcel V2 using the Transcrypt transpiler
**_Consider this Parcel transformer to be in beta mode and still a work in progress._**

### Installation
This Parcel transformer can be installed with npm or yarn:
```bash
npm install parcel-transformer-transcrypt -D
```

### Dependencies
Obviously Parcel V2 must be installed:

```bash
npm install parcel -D
```
This plugin also requires installation of the Transcrypt transpiler.

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

You will need to create a _.parcelrc_ file to let Parcel know how to handle the Python files:

_.parcelrc_
```json
{
  "extends": ["@parcel/config-default"],
  "transformers": {
    "*.py": ["parcel-transformer-transcrypt"]
  }
}
```

### Notes
This has been tested with Node version 16 and npm version 8 on Linux

