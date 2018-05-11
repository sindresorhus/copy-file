'use strict';
const path = require('path');
const fsConstants = require('fs').constants;
const {Buffer} = require('safe-buffer');
const CpFileError = require('./cp-file-error');
const fs = require('./fs');
const ProgressEmitter = require('./progress-emitter');

module.exports = (src, dest, opts) => {
	if (!src || !dest) {
		return Promise.reject(new CpFileError('`src` and `dest` required'));
	}

	opts = Object.assign({overwrite: true}, opts);

	const progressEmitter = new ProgressEmitter(path.resolve(src), path.resolve(dest));

	const promise = fs
		.stat(src)
		.then(stat => {
			progressEmitter.size = stat.size;
		})
		.then(() => fs.createReadStream(src))
		.then(read => fs.makeDir(path.dirname(dest)).then(() => read))
		.then(read => new Promise((resolve, reject) => {
			const write = fs.createWriteStream(dest, {flags: opts.overwrite ? 'w' : 'wx'});

			read.on('data', () => {
				progressEmitter.written = write.bytesWritten;
			});

			write.on('error', err => {
				if (!opts.overwrite && err.code === 'EEXIST') {
					resolve(false);
					return;
				}

				reject(new CpFileError(`Cannot write to \`${dest}\`: ${err.message}`, err));
			});

			write.on('close', () => {
				progressEmitter.written = progressEmitter.size;
				resolve(true);
			});

			read.pipe(write);
		}))
		.then(updateStats => {
			if (updateStats) {
				return fs.lstat(src).then(stats => Promise.all([
					fs.utimes(dest, stats.atime, stats.mtime),
					fs.chmod(dest, stats.mode),
					fs.chown(dest, stats.uid, stats.gid)
				]));
			}
		});

	promise.on = (...args) => {
		progressEmitter.on(...args);
		return promise;
	};

	return promise;
};

const checkSrcIsFile = (stat, src) => {
	if (stat.isDirectory()) {
		throw Object.assign(new CpFileError(`EISDIR: illegal operation on a directory '${src}'`), {
			errno: -21,
			code: 'EISDIR',
			src
		});
	}
};

const fixupAttributes = (dest, stat) => {
	fs.chmodSync(dest, stat.mode);
	fs.chownSync(dest, stat.uid, stat.gid);
};

const copySyncNative = (src, dest, opts) => {
	const stat = fs.statSync(src);
	checkSrcIsFile(stat, src);
	fs.makeDirSync(path.dirname(dest));

	const flags = opts.overwrite ? null : fsConstants.COPYFILE_EXCL;
	try {
		fs.copyFileSync(src, dest, flags);
	} catch (err) {
		if (!opts.overwrite && err.code === 'EEXIST') {
			return;
		}

		throw err;
	}

	fs.utimesSync(dest, stat.atime, stat.mtime);
	fixupAttributes(dest, stat);
};

const copySyncFallback = (src, dest, opts) => {
	let read; // eslint-disable-line prefer-const
	let bytesRead;
	let pos;
	let write;
	const BUF_LENGTH = 100 * 1024;
	const buf = Buffer.alloc(BUF_LENGTH);
	const readSync = pos => fs.readSync(read, buf, 0, BUF_LENGTH, pos, src);
	const writeSync = () => fs.writeSync(write, buf, 0, bytesRead, undefined, dest);

	read = fs.openSync(src, 'r');
	bytesRead = readSync(0);
	pos = bytesRead;
	fs.makeDirSync(path.dirname(dest));

	try {
		write = fs.openSync(dest, opts.overwrite ? 'w' : 'wx');
	} catch (err) {
		if (!opts.overwrite && err.code === 'EEXIST') {
			return;
		}

		throw err;
	}

	writeSync();

	while (bytesRead === BUF_LENGTH) {
		bytesRead = readSync(pos);
		writeSync();
		pos += bytesRead;
	}

	const stat = fs.fstatSync(read, src);
	fs.futimesSync(write, stat.atime, stat.mtime, dest);
	fs.closeSync(read);
	fs.closeSync(write);
	fixupAttributes(dest, stat);
};

module.exports.sync = (src, dest, opts) => {
	if (!src || !dest) {
		throw new CpFileError('`src` and `dest` required');
	}

	opts = Object.assign({overwrite: true}, opts);

	if (fs.copyFileSync) {
		copySyncNative(src, dest, opts);
	} else {
		copySyncFallback(src, dest, opts);
	}
};
