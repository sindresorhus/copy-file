# cp-file

> Copy a file

## Highlights

- Fast by using streams in the async version and [`fs.copyFileSync()`](https://nodejs.org/api/fs.html#fs_fs_copyfilesync_src_dest_flags) in the synchronous version.
- Resilient by using [graceful-fs](https://github.com/isaacs/node-graceful-fs).
- User-friendly by creating non-existent destination directories for you.
- Can be safe by turning off [overwriting](#optionsoverwrite).
- Preserves file mode, [but not ownership](https://github.com/sindresorhus/cp-file/issues/22#issuecomment-502079547).
- User-friendly errors.

## Install

```
$ npm install cp-file
```

## Usage

```js
const cpFile = require('cp-file');

(async () => {
	await cpFile('source/unicorn.png', 'destination/unicorn.png');
	console.log('File copied');
})();
```

## API

### cpFile(source, destination, options?)

Returns a `Promise` that resolves when the file is copied.

### cpFile.sync(source, destination, options?)

#### source

Type: `string`

The file you want to copy.

#### destination

Type: `string`

Where you want the file copied.

#### options

Type: `object`

##### overwrite

Type: `boolean`\
Default: `true`

Overwrite existing destination file.

##### directoryMode

Type: `number`\
Default: `0o777`

[Permissions](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) for created directories.

It has no effect on Windows.

### cpFile.on('progress', handler)

Progress reporting. Only available when using the async method.

#### handler(data)

Type: `Function`

##### data

```js
{
	sourcePath: string,
	destinationPath: string,
	size: number,
	writtenBytes: number,
	percent: number
}
```

- `source` and `destination` are absolute paths.
- `size` and `writtenBytes` are in bytes.
- `percent` is a value between `0` and `1`.

###### Notes

- For empty files, the `progress` event is emitted only once.
- The `.on()` method is available only right after the initial `cpFile()` call. So make sure
you add a `handler` before `.then()`:

```js
const cpFile = require('cp-file');

(async () => {
	await cpFile(source, destination).on('progress', data => {
		// …
	});
})();
```

## Related

- [cpy](https://github.com/sindresorhus/cpy) - Copy files
- [cpy-cli](https://github.com/sindresorhus/cpy-cli) - Copy files on the command-line
- [move-file](https://github.com/sindresorhus/move-file) - Move a file
- [make-dir](https://github.com/sindresorhus/make-dir) - Make a directory and its parents if needed
