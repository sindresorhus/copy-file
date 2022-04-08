declare namespace cpFile {
	interface Options {
		/**
		Overwrite existing destination file.

		@default true
		*/
		readonly overwrite?: boolean;

		/**
		[Permissions](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) for created directories.

		It has no effect on Windows.

		@default 0o777
		*/
		readonly directoryMode?: number;

		/**
		When your source, destination path are relative, `cp-file` basically finds out the source, destination paths from the path you executed the process (`process.dir()`)

		You can change this base path to which path you want.

		This ensures `cp-file`'s behavior be same regardless of your path executed the process.

		When your source, destination path are not relative, this option is ignored.

		@default process.cwd()
		*/
		readonly cwd?: string;
	}

	interface ProgressData {
		/**
		Absolute path to source.
		*/
		sourcePath: string;

		/**
		Absolute path to destination.
		*/
		destinationPath: string;

		/**
		File size in bytes.
		*/
		size: number;

		/**
		Copied size in bytes.
		*/
		writtenBytes: number;

		/**
		Copied percentage, a value between `0` and `1`.
		*/
		percent: number;
	}

	interface ProgressEmitter {
		/**
		Note: For empty files, the `progress` event is emitted only once.
		*/
		on(event: 'progress', handler: (data: ProgressData) => void): Promise<void>;
	}
}

declare const cpFile: {
	/**
	Copy a file.

	@param source - The file you want to copy.
	@param destination - Where you want the file copied.
	@returns A `Promise` that resolves when the file is copied.

	@example
	```
	import cpFile = require('cp-file');

	(async () => {
		await cpFile('source/unicorn.png', 'destination/unicorn.png');
		console.log('File copied');
	})();
	```
	*/
	(source: string, destination: string, options?: cpFile.Options): Promise<void> & cpFile.ProgressEmitter;

	/**
	Copy a file synchronously.

	@param source - The file you want to copy.
	@param destination - Where you want the file copied.

	@example
	```
	import cpFile = require('cp-file');

	cpFile.sync('source/unicorn.png', 'destination/unicorn.png');
	```
	*/
	sync(source: string, destination: string, options?: cpFile.Options): void;
};

export = cpFile;
