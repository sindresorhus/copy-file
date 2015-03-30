'use strict';
var path = require('path');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var objectAssign = require('object-assign');
var onetime = require('onetime');
var NestedError = require('nested-error-stacks');
var util = require('util');

function CpFileError(message, nested) {
	NestedError.call(this, message, nested);
	objectAssign(this, nested, {message: message});
}

util.inherits(CpFileError, NestedError);

CpFileError.prototype.name = 'CpFileError';

module.exports = function (src, dest, opts, cb) {
	if (!src || !dest) {
		throw new CpFileError('`src` and `dest` required');
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	cb = onetime(cb || function () {});
	opts = objectAssign({overwrite: true}, opts);

	var read = fs.createReadStream(src);
	var readListener = onetime(startWrite);

	read.on('error', function (err) {
		cb(new CpFileError('cannot read from `' + src + '`: ' + err.message, err));
	});
	read.on('readable', readListener);
	read.on('end', readListener);

	function startWrite() {
		mkdirp(path.dirname(dest), function (err) {
			if (err && err.code !== 'EEXIST') {
				cb(new CpFileError('cannot create directory `' + path.dirname(dest) + '`: ' + err.message, err));
				return;
			}

			var write = fs.createWriteStream(dest, {flags: opts.overwrite ? 'w' : 'wx'});

			write.on('error', function (err) {
				if (!opts.overwrite && err.code === 'EEXIST') {
					cb();
					return;
				}
				cb(new CpFileError(err, 'cannot write to `' + dest + '`: ' + err.message, err));
			});

			write.on('close', function () {
				fs.lstat(src, function (err, stats) {
					if (err) {
						cb(new CpFileError('lstat `' + src + '` failed: ' + err.message, err));
						return;
					}

					fs.utimes(dest, stats.atime, stats.mtime, function (err) {
						if (err) {
							cb(new CpFileError('utimes `' + dest + '` failed: ' + err.message, err));
							return;
						}
						cb();
					});
				});
			});

			read.pipe(write);
		});
	}
};

module.exports.sync = function (src, dest, opts) {
	if (!src || !dest) {
		throw new CpFileError('`src` and `dest` required');
	}

	opts = objectAssign({overwrite: true}, opts);

	var read = fs.openSync(src, 'r');
	var BUF_LENGTH = 100 * 1024;
	var buf = new Buffer(BUF_LENGTH);
	var bytesRead = readSync(0);
	var pos = bytesRead;
	var write;

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

	var stat = fs.fstatSync(read);
	fs.futimesSync(write, stat.atime, stat.mtime);
	fs.closeSync(read);
	fs.closeSync(write);
};
