'use strict';
const {promisify} = require('util');
const fs = require('graceful-fs');
const makeDir = require('make-dir');
const pEvent = require('p-event');
const CpFileError = require('./cp-file-error');
const {version} = process;

const stat = promisify(fs.stat);
const lstat = promisify(fs.lstat);
const utimes = promisify(fs.utimes);
const chmod = promisify(fs.chmod);

exports.closeSync = fs.closeSync.bind(fs);
exports.createWriteStream = fs.createWriteStream.bind(fs);

/**
@param {import('fs').PathLike} path
@param {object} [options]
 */
exports.createReadStream = async (path, options) => {
	const read = fs.createReadStream(path, options);

	try {
		await pEvent(read, ['readable', 'end']);
	} catch (error) {
		throw new CpFileError(`Cannot read from \`${path}\`: ${error.message}`, error);
	}

	return read;
};

/**
@param {import('fs').PathLike} path
 */
exports.stat = path => stat(path).catch(error => {
	throw new CpFileError(`Cannot stat path \`${path}\`: ${error.message}`, error);
});

/**
@param {import('fs').PathLike} path
 */
exports.lstat = path => lstat(path).catch(error => {
	throw new CpFileError(`lstat \`${path}\` failed: ${error.message}`, error);
});

/**
@param {import('fs').PathLike} path
@param {string | number | Date} atime
@param {string | number | Date} mtime
 */
exports.utimes = (path, atime, mtime) => utimes(path, atime, mtime).catch(error => {
	throw new CpFileError(`utimes \`${path}\` failed: ${error.message}`, error);
});

/**
@param {import('fs').PathLike} path
@param {import('fs').Mode} mode
 */
exports.chmod = (path, mode) => chmod(path, mode).catch(error => {
	throw new CpFileError(`chmod \`${path}\` failed: ${error.message}`, error);
});

/**
@param {import('fs').PathLike} path
 */
exports.statSync = path => {
	try {
		return fs.statSync(path);
	} catch (error) {
		throw new CpFileError(`stat \`${path}\` failed: ${error.message}`, error);
	}
};

/**
@param {import('fs').PathLike} path
@param {string | number | Date} atime
@param {string | number | Date} mtime
 */
exports.utimesSync = (path, atime, mtime) => {
	try {
		return fs.utimesSync(path, atime, mtime);
	} catch (error) {
		throw new CpFileError(`utimes \`${path}\` failed: ${error.message}`, error);
	}
};

/**
@param {string} path
 */
exports.makeDir = path => makeDir(path, {fs}).catch(error => {
	throw new CpFileError(`Cannot create directory \`${path}\`: ${error.message}`, error);
});

/**
@param {string} path
 */
exports.makeDirSync = path => {
	try {
		makeDir.sync(path, {fs});
	} catch (error) {
		throw new CpFileError(`Cannot create directory \`${path}\`: ${error.message}`, error);
	}
};

/**
@param {import('fs').PathLike} source
@param {import('fs').PathLike} destination
@param {number?} [flags]
 */
exports.cloneFileSync = (source, destination, flags) => {
	try {
		if (!Object.prototype.hasOwnProperty.call(fs.constants, 'COPYFILE_FICLONE_FORCE')) {
			throw new CpFileError(`Node ${version} does not understand cloneFile`);
		}

		if (flags == undefined) flags = 0;
		fs.copyFileSync(source, destination, flags | fs.constants.COPYFILE_FICLONE_FORCE);
	} catch (error) {
		throw new CpFileError(`Cannot clone from \`${source}\` to \`${destination}\`: ${error.message}`, error);
	}
};

/**
@param {import('fs').PathLike} source
@param {import('fs').PathLike} destination
@param {number?} [flags]
 */
exports.copyFileSync = (source, destination, flags) => {
	try {
		if (flags === null) flags = undefined;
		fs.copyFileSync(source, destination, flags);
	} catch (error) {
		throw new CpFileError(`Cannot copy from \`${source}\` to \`${destination}\`: ${error.message}`, error);
	}
};
