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
		The working directory to find source files.

		The source and destination path are relative to this.

		@default process.cwd()
		*/
		readonly cwd?: string;
	}

	interface AsyncOptions {
		/**
		This callback function is emitted anytime copying experiences measurable progress.

		Note: For empty files, the `onProgress` event is emitted only once.

		@example
		```
		import cpFile = require('cp-file');

		(async () => {
			await cpFile('source/unicorn.png', 'destination/unicorn.png', {
				onProgress: (progress) => {
					// ...
				}
			});
		})();
		```
		*/
		readonly onProgress?: (progress: ProgressData) => void;
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
		@deprecated Use `onProgress` option instead.

		Note: For empty files, the `progress` event is emitted only once.
		*/
		on(event: 'progress', handler: AsyncOptions['onProgress']): Promise<void>;
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
	(source: string, destination: string, options?: cpFile.Options & cpFile.AsyncOptions): Promise<void> & cpFile.ProgressEmitter;

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
