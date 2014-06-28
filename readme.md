# cp-file [![Build Status](https://travis-ci.org/sindresorhus/cp-file.svg?branch=master)](https://travis-ci.org/sindresorhus/cp-file)

> Copy a file

- Fast by using streams in the async version.  
- Resilient by using [graceful-fs](https://github.com/isaacs/node-graceful-fs).  
- User-friendly by creating non-existant destination directories for you.  
- Can be safe by turning off [overwriting](#optionsoverwrite).


## Install

```sh
$ npm install --save cp-file
```


## Usage

```js
var cpFile = require('cp-file');

cpFile('src/unicorn.png', 'dist/unicorn.png', function (err) {
	console.log('file copied');
});
```


## API

### cpFile(source, destination, [options], [callback])
### cpFile.sync(source, destination, [options])

#### source

*Required*  
Type: `string`

File you want to copy.

#### destination

*Required*  
Type: `string`

Where you want the file copied.

#### options

Type: `object`

##### options.overwrite

Type: `boolean`  
Default: `true`

Overwrite existing file.

#### callback(err)

Type: `function`


## Related

See [cpy](https://github.com/sindresorhus/cpy) if you need to copy multiple files or want a CLI.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
