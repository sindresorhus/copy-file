import {expectType} from 'tsd-check';
import cpFile, {sync as cpFileSync, ProgressEmitter, ProgressData} from '.';

// CpFile
expectType<Promise<void> & ProgressEmitter>(
	cpFile('src/unicorn.png', 'dist/unicorn.png')
);
expectType<Promise<void> & ProgressEmitter>(
	cpFile('src/unicorn.png', 'dist/unicorn.png', {overwrite: false})
);
expectType<Promise<void>>(
	cpFile('src/unicorn.png', 'dist/unicorn.png').on('progress', data => {
		expectType<ProgressData>(data);

		expectType<string>(data.src);
		expectType<string>(data.dest);
		expectType<number>(data.size);
		expectType<number>(data.written);
		expectType<number>(data.percent);
	})
);

// CpFile (sync)
expectType<void>(cpFileSync('src/unicorn.png', 'dist/unicorn.png'));
expectType<void>(
	cpFileSync('src/unicorn.png', 'dist/unicorn.png', {overwrite: false})
);
