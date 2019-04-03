import {expectType} from 'tsd';
import cpFile = require('.');
import {ProgressEmitter, ProgressData} from '.';

expectType<Promise<void> & ProgressEmitter>(
	cpFile('source/unicorn.png', 'destination/unicorn.png')
);
expectType<Promise<void> & ProgressEmitter>(
	cpFile('source/unicorn.png', 'destination/unicorn.png', {overwrite: false})
);
expectType<Promise<void>>(
	cpFile('source/unicorn.png', 'destination/unicorn.png').on(
		'progress',
		data => {
			expectType<ProgressData>(data);

			expectType<string>(data.src);
			expectType<string>(data.dest);
			expectType<number>(data.size);
			expectType<number>(data.written);
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
