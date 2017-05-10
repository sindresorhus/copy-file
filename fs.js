'use strict';
const fs = require('graceful-fs');
const makeDir = require('make-dir');
const pify = require('pify');
const CpFileError = require('./cp-file-error');

const fsP = pify(fs);

exports.closeSync = fs.closeSync.bind(fs);
exports.createWriteStream = fs.createWriteStream.bind(fs);

exports.createReadStream = (path, options) => new Promise((resolve, reject) => {
	const read = fs.createReadStream(path, options);

	read.on('error', err => {
		reject(new CpFileError(`cannot read from \`${path}\`: ${err.message}`, err));
	});

	read.on('readable', () => {
		resolve(read);
	});

	read.on('end', () => {
		resolve(read);
	});
});

exports.stat = path => fsP.stat(path).catch(err => {
	throw new CpFileError(`cannot stat path \`${path}\`: ${err.message}`, err);
});

exports.lstat = path => fsP.lstat(path).catch(err => {
	throw new CpFileError(`lstat \`${path}\` failed: ${err.message}`, err);
});

exports.utimes = (path, atime, mtime) => fsP.utimes(path, atime, mtime).catch(err => {
	throw new CpFileError(`utimes \`${path}\` failed: ${err.message}`, err);
});

exports.openSync = (path, flags, mode) => {
	try {
		return fs.openSync(path, flags, mode);
	} catch (err) {
		if (flags.includes('w')) {
			throw new CpFileError(`cannot write to \`${path}\`: ${err.message}`, err);
		}

		throw new CpFileError(`cannot open \`${path}\`: ${err.message}`, err);
	}
};

// eslint-disable-next-line max-params
exports.readSync = (fd, buffer, offset, length, position, path) => {
	try {
		return fs.readSync(fd, buffer, offset, length, position);
	} catch (err) {
		throw new CpFileError(`cannot read from \`${path}\`: ${err.message}`, err);
	}
};

// eslint-disable-next-line max-params
exports.writeSync = (fd, buffer, offset, length, position, path) => {
	try {
		return fs.writeSync(fd, buffer, offset, length, position);
	} catch (err) {
		throw new CpFileError(`cannot write to \`${path}\`: ${err.message}`, err);
	}
};

exports.fstatSync = (fd, path) => {
	try {
		return fs.fstatSync(fd);
	} catch (err) {
		throw new CpFileError(`stat \`${path}\` failed: ${err.message}`, err);
	}
};

exports.futimesSync = (fd, atime, mtime, path) => {
	try {
		return fs.futimesSync(fd, atime, mtime, path);
	} catch (err) {
		throw new CpFileError(`utimes \`${path}\` failed: ${err.message}`, err);
	}
};

exports.makeDir = path => makeDir(path, {fs}).catch(err => {
	throw new CpFileError(`cannot create directory \`${path}\`: ${err.message}`, err);
});

exports.makeDirSync = path => {
	try {
		makeDir.sync(path, {fs});
	} catch (err) {
		throw new CpFileError(`cannot create directory \`${path}\`: ${err.message}`, err);
	}
};
