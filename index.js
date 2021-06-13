'use strict';
const path = require('path');
const {constants: fsConstants} = require('fs');
const pEvent = require('p-event');
const CpFileError = require('./cp-file-error');
const fs = require('./fs');
const ProgressEmitter = require('./progress-emitter');

const cpFileAsync = async (source, destination, options, progressEmitter) => {
	let readError;
	const stat = await fs.stat(source);
	progressEmitter.size = stat.size;

	const readStream = await fs.createReadStream(source);
	await fs.makeDir(path.dirname(destination), {mode: options.directoryMode});
	const writeStream = fs.createWriteStream(destination, {flags: options.overwrite ? 'w' : 'wx'});

	readStream.on('data', () => {
		progressEmitter.writtenBytes = writeStream.bytesWritten;
	});

	readStream.once('error', error => {
		readError = new CpFileError(`Cannot read from \`${source}\`: ${error.message}`, error);
		writeStream.end();
	});

	let shouldUpdateStats = false;
	try {
		const writePromise = pEvent(writeStream, 'close');
		readStream.pipe(writeStream);
		await writePromise;
		progressEmitter.writtenBytes = progressEmitter.size;
		shouldUpdateStats = true;
	} catch (error) {
		throw new CpFileError(`Cannot write to \`${destination}\`: ${error.message}`, error);
	}

	if (readError) {
		throw readError;
	}

	if (shouldUpdateStats) {
		const stats = await fs.lstat(source);

		return Promise.all([
			fs.utimes(destination, stats.atime, stats.mtime),
			fs.chmod(destination, stats.mode)
		]);
	}
};

const cpFile = (sourcePath, destinationPath, options) => {
	if (!sourcePath || !destinationPath) {
		return Promise.reject(new CpFileError('`source` and `destination` required'));
	}

	options = {
		overwrite: true,
		...options
	};

	const progressEmitter = new ProgressEmitter(path.resolve(sourcePath), path.resolve(destinationPath));
	const promise = cpFileAsync(sourcePath, destinationPath, options, progressEmitter);

	promise.on = (...arguments_) => {
		progressEmitter.on(...arguments_);
		return promise;
	};

	return promise;
};

module.exports = cpFile;

const checkSourceIsFile = (stat, source) => {
	if (stat.isDirectory()) {
		throw Object.assign(new CpFileError(`EISDIR: illegal operation on a directory '${source}'`), {
			errno: -21,
			code: 'EISDIR',
			source
		});
	}
};

module.exports.sync = (source, destination, options) => {
	if (!source || !destination) {
		throw new CpFileError('`source` and `destination` required');
	}

	options = {
		overwrite: true,
		...options
	};

	const stat = fs.statSync(source);
	checkSourceIsFile(stat, source);
	fs.makeDirSync(path.dirname(destination), {mode: options.directoryMode});

	const flags = options.overwrite ? null : fsConstants.COPYFILE_EXCL;
	try {
		fs.copyFileSync(source, destination, flags);
	} catch (error) {
		if (!options.overwrite && error.code === 'EEXIST') {
			return;
		}

		throw error;
	}

	fs.utimesSync(destination, stat.atime, stat.mtime);
};
