'use strict';

exports.buildEACCES = path => Object.assign(new Error(`EACCES: permission denied '${path}'`), {
	errno: -13,
	code: 'EACCES',
	path
});

exports.buildENOSPC = () => Object.assign(new Error('ENOSPC, write'), {
	errno: -28,
	code: 'ENOSPC'
});

exports.buildENOENT = path => Object.assign(new Error(`ENOENT: no such file or directory '${path}'`), {
	errno: -2,
	code: 'ENOENT',
	path
});

exports.buildEBADF = () => Object.assign(new Error(`EBADF: bad file descriptor`), {
	errno: -9,
	code: 'EBADF'
});
