import {expectError, expectType} from 'tsd';
import {copyFile, copyFileSync, ProgressData} from './index.js';

expectType<Promise<void> >(
	copyFile('source/unicorn.png', 'destination/unicorn.png'),
);
expectType<Promise<void>>(
	copyFile('source/unicorn.png', 'destination/unicorn.png', {overwrite: false}),
);
expectType<Promise<void>>(
	copyFile('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: 0o700,
	}),
);
expectError(
	await copyFile('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: '700',
	}),
);
expectType<Promise<void>>(
	copyFile('source/unicorn.png', 'destination/unicorn.png', {
		onProgress(progress) {
			expectType<ProgressData>(progress);
			expectType<string>(progress.sourcePath);
			expectType<string>(progress.destinationPath);
			expectType<number>(progress.size);
			expectType<number>(progress.writtenBytes);
			expectType<number>(progress.percent);
		},
	}),
);

expectType<void>(copyFileSync('source/unicorn.png', 'destination/unicorn.png'));
expectType<void>(
	copyFileSync('source/unicorn.png', 'destination/unicorn.png', {
		overwrite: false,
	}),
);
expectType<void>(
	copyFileSync('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: 0o700,
	}),
);
expectError(
	copyFileSync('source/unicorn.png', 'destination/unicorn.png', {
		directoryMode: '700',
	}),
);
