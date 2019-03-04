import {expectType} from 'tsd-check';
import cpFile, {sync as cpFileSync, ProgressEmitter, ProgressData} from '.';

// `cpFile`
expectType<Promise<void> & ProgressEmitter>(
	cpFile('source/unicorn.png', 'destination/unicorn.png')
);
expectType<Promise<void> & ProgressEmitter>(
	cpFile('source/unicorn.png', 'destination/unicorn.png', {overwrite: false})
);
expectType<Promise<void>>(
	cpFile('source/unicorn.png', 'destination/unicorn.png').on('progress', data => {
		expectType<ProgressData>(data);

		expectType<string>(data.src);
		expectType<string>(data.dest);
		expectType<number>(data.size);
		expectType<number>(data.written);
		expectType<number>(data.percent);
	})
);

// `cpFileSync`
expectType<void>(cpFileSync('source/unicorn.png', 'destination/unicorn.png'));
expectType<void>(
	cpFileSync('source/unicorn.png', 'destination/unicorn.png', {overwrite: false})
);
