'use strict';
const path = require('path');
const Buffer = require('safe-buffer').Buffer;
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

				reject(new CpFileError(`cannot write to \`${dest}\`: ${err.message}`, err));
			});

			write.on('close', () => {
				progressEmitter.written = progressEmitter.size;
				resolve(true);
			});

			read.pipe(write);
		}))
		.then(updateTimes => {
			if (updateTimes) {
				return fs.lstat(src).then(stats => fs.utimes(dest, stats.atime, stats.mtime));
			}
		});

	promise.on = function () {
		progressEmitter.on.apply(progressEmitter, arguments);
		return promise;
	};

	return promise;
};

module.exports.sync = function (src, dest, opts) {
	if (!src || !dest) {
		throw new CpFileError('`src` and `dest` required');
	}

	opts = Object.assign({overwrite: true}, opts);

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
};
