import {expectError, expectType} from 'tsd';
import cpFile = require('.');
import {ProgressEmitter, ProgressData} from '.';

expectType<Promise<void> & ProgressEmitter>(
	cpFile('source/unicorn.png', 'destination/unicorn.png')
);
expectType<Promise<void> & ProgressEmitter>(
	cpFile('source/unicorn.png', 'destination/unicorn.png', {overwrite: false})
);
expectType<Promise<void> & ProgressEmitter>(
	cpFile('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: 0o700
	})
);
expectError(
	await cpFile('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: '700'
	})
);
expectType<Promise<void>>(
	cpFile('source/unicorn.png', 'destination/unicorn.png').on(
		'progress',
		data => {
			expectType<ProgressData>(data);

			expectType<string>(data.sourcePath);
			expectType<string>(data.destinationPath);
			expectType<number>(data.size);
			expectType<number>(data.writtenBytes);
			expectType<number>(data.percent);
		}
	)
);

expectType<void>(cpFile.sync('source/unicorn.png', 'destination/unicorn.png'));
expectType<void>(
	cpFile.sync('source/unicorn.png', 'destination/unicorn.png', {
		overwrite: false
	})
);
expectType<void>(
	cpFile.sync('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: 0o700
	})
);
expectError(
	cpFile.sync('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: '700'
	})
);
