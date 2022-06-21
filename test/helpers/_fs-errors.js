export const buildEACCES = path => Object.assign(new Error(`EACCES: permission denied '${path}'`), {
	errno: -13,
	code: 'EACCES',
	path,
});

export const buildENOSPC = () => Object.assign(new Error('ENOSPC, write'), {
	errno: -28,
	code: 'ENOSPC',
});

export const buildENOENT = path => Object.assign(new Error(`ENOENT: no such file or directory '${path}'`), {
	errno: -2,
	code: 'ENOENT',
	path,
});

export const buildERRSTREAMWRITEAFTEREND = () => Object.assign(new Error('ERR_STREAM_WRITE_AFTER_END'), {
	code: 'ERR_STREAM_WRITE_AFTER_END',
});

export const buildEBADF = () => Object.assign(new Error('EBADF: bad file descriptor'), {
	errno: -9,
	code: 'EBADF',
});

export const buildEPERM = (path, method) => Object.assign(new Error(`EPERM: ${method} '${path}''`), {
	errno: 50,
	code: 'EPERM',
});
