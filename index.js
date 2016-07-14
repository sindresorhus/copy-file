'use strict';
var path = require('path');
var util = require('util');
var Promise = require('pinkie-promise');
var pify = require('pify');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var objectAssign = require('object-assign');
var NestedError = require('nested-error-stacks');

var mkdirpP = pify(mkdirp, Promise);
var fsP = pify(fs, Promise);

function CpFileError(message, nested) {
	NestedError.call(this, message, nested);
	objectAssign(this, nested);
}

util.inherits(CpFileError, NestedError);

CpFileError.prototype.name = 'CpFileError';

function statSource(src, progress) {
	if (!progress.enabled) {
		return Promise.resolve();
	}
	return fsP.stat(src).then(function (stat) {
		progress.stat = stat;
	}).catch(function (err) {
		Promise.reject(new CpFileError('NO_ENTRY', err));
	});
}

module.exports = function (src, dest, opts) {
	if (!src || !dest) {
		return Promise.reject(new CpFileError('`src` and `dest` required'));
	}

	opts = objectAssign({overwrite: true, onProgress: function () {}}, opts);

	var progressEnabled = typeof opts.onProgress === 'function';
	var progress = {
		enabled: progressEnabled,
		stat: null
	};

	return statSource(src, progress).then(function () {
		var read = fs.createReadStream(src);
		return new Promise(function (resolve, reject) {
			read.on('error', function (err) {
				reject(new CpFileError('cannot read from `' + src + '`: ' + err.message, err));
			});

			read.on('readable', function () {
				resolve(read);
			});

			read.on('end', function () {
				resolve(read);
			});
		});
	}).then(function mkdirpDestDirectory(read) {
		return mkdirpP(path.dirname(dest)).then(function () {
			return read;
		}).catch(function (err) {
			if (err.code !== 'EEXIST') {
				throw new CpFileError('cannot create directory `' + path.dirname(dest) + '`: ' + err.message, err);
			}

			return read;
		});
	}).then(function (read) {
		return new Promise(function pipeToDest(resolve, reject) {
			var write = fs.createWriteStream(dest, {flags: opts.overwrite ? 'w' : 'wx'});

			write.on('error', function (err) {
				if (!opts.overwrite && err.code === 'EEXIST') {
					resolve(false);
					return;
				}

				reject(new CpFileError('cannot write to `' + dest + '`: ' + err.message, err));
			});

			write.on('close', function () {
				resolve(true);
			});

			read.on('data', function () {
				var written = write.bytesWritten;
				var percent = (written / progress.stat.size).toPrecision(2);
				opts.onProgress({
					src: src,
					dest: dest,
					size: progress.stat.size,
					written: written,
					percent: percent
				});
			});

			read.on('close', function () {
				opts.onProgress({
					file: src,
					written: progress.stat.size,
					remains: 0,
					percent: 100
				});
			});

			read.pipe(write);
		});
	}).then(function (updateTimes) {
		if (updateTimes) {
			return fsP.lstat(src).catch(function (err) {
				throw new CpFileError('lstat `' + src + '` failed: ' + err.message, err);
			}).then(function (stats) {
				return fsP.utimes(dest, stats.atime, stats.mtime).catch(function (err) {
					throw new CpFileError('utimes `' + dest + '` failed: ' + err.message, err);
				});
			});
		}
	});
};

module.exports.sync = function (src, dest, opts) {
	if (!src || !dest) {
		throw new CpFileError('`src` and `dest` required');
	}

	opts = objectAssign({overwrite: true}, opts);

	var read;
	var bytesRead;
	var pos;
	var write;
	var stat;
	var BUF_LENGTH = 100 * 1024;
	var buf = new Buffer(BUF_LENGTH);

	function readSync(pos) {
		try {
			return fs.readSync(read, buf, 0, BUF_LENGTH, pos);
		} catch (err) {
			throw new CpFileError('cannot read from `' + src + '`: ' + err.message, err);
		}
	}

	function writeSync() {
		try {
			fs.writeSync(write, buf, 0, bytesRead);
		} catch (err) {
			throw new CpFileError('cannot write to `' + dest + '`: ' + err.message, err);
		}
	}

	try {
		read = fs.openSync(src, 'r');
	} catch (err) {
		throw new CpFileError('cannot open `' + src + '`: ' + err.message, err);
	}

	pos = bytesRead = readSync(0);

	try {
		mkdirp.sync(path.dirname(dest));
	} catch (err) {
		if (err.code !== 'EEXIST') {
			throw new CpFileError('cannot create directory `' + path.dirname(dest) + '`: ' + err.message, err);
		}
	}

	try {
		write = fs.openSync(dest, opts.overwrite ? 'w' : 'wx');
	} catch (err) {
		if (!opts.overwrite && err.code === 'EEXIST') {
			return;
		}

		throw new CpFileError('cannot write to `' + dest + '`: ' + err.message, err);
	}

	writeSync();

	while (bytesRead === BUF_LENGTH) {
		bytesRead = readSync(pos);
		writeSync();
		pos += bytesRead;
	}

	try {
		stat = fs.fstatSync(read);
	} catch (err) {
		throw new CpFileError('stat `' + src + '` failed: ' + err.message, err);
	}

	try {
		fs.futimesSync(write, stat.atime, stat.mtime);
	} catch (err) {
		throw new CpFileError('utimes `' + dest + '` failed: ' + err.message, err);
	}

	fs.closeSync(read);
	fs.closeSync(write);
};
