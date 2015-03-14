'use strict';
var path = require('path');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var assign = require('object-assign');
var onetime = require('onetime');
var VError = require('verror');

module.exports = function (src, dest, opts, cb) {
	if (!src || !dest) {
		throw new assign(new VError('`src` and `dest` required'), { name: 'CpFileError' })
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	cb = onetime(cb || function () {});
	opts = assign({overwrite: true}, opts);

	var read = fs.createReadStream(src);
	var readListener = onetime(startWrite);

	read.on('error', function (err) {
		if (err) {
			err = assign(new VError(err, 'cannot read from \'%s\'', src), { name: 'CpFileError' });
		}

		cb(err);
	});
	read.on('readable', readListener);
	read.on('end', readListener);

	function startWrite() {
		mkdirp(path.dirname(dest), function (err) {
			if (err && err.code !== 'EEXIST') {
				cb(assign(new VError(err, 'cannot create directory \'%s\'', dest), { name: 'CpFileError' }));
				return;
			}

			var write = fs.createWriteStream(dest, {flags: opts.overwrite ? 'w' : 'wx'});

			write.on('error', function (err) {
				if (!opts.overwrite && err.code === 'EEXIST') {
					cb();
					return;
				}

				cb(assign(new VError(err, 'cannot write to \'%s\'', dest), { name: 'CpFileError' }));
			});

			write.on('close', function () {
				fs.lstat(src, function (err, stats) {
					if (err) {
						cb(assign(new VError(err, 'lstat \'%s\' failed', src), { name: 'CpFileError' }));
						return;
					}

					fs.utimes(dest, stats.atime, stats.mtime, function (err) {
						if (err) {
							err = assign(new VError(err, 'utimes \'%s\' failed', dest), { name: 'CpFileError' });
						}
						cb(err);
					});
				});
			});

			read.pipe(write);
		});
	}
};


module.exports.sync = function (src, dest, opts) {
	if (!src || !dest) {
		throw new assign(new VError('`src` and `dest` required'), { name: 'CpFileError' })
	}

	opts = assign({overwrite: true}, opts);

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
			throw assign(new VError(err, 'cannot read from \'%s\'', src), { name: 'CpFileError' });
		}
	}

	function writeSync() {
		try {
			fs.writeSync(write, buf, 0, bytesRead);
		} catch (err) {
			throw assign(new VError(err, 'cannot write to \'%s\'', dest), { name: 'CpFileError' });
		}
	}

	try {
		mkdirp.sync(path.dirname(dest));
	} catch (err) {
		if (err.code !== 'EEXIST') {
			throw assign(new VError(err, 'cannot create directory \'%s\'', dest), { name: 'CpFileError' });
		}
	}

	try {
		write = fs.openSync(dest, opts.overwrite ? 'w' : 'wx');
	} catch (err) {
		if (!opts.overwrite && err.code === 'EEXIST') {
			return;
		}
		throw assign(new VError(err, 'cannot write to \'%s\'', dest), { name: 'CpFileError' });
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
