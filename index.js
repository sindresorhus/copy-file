'use strict';
var path = require('path');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var objectAssign = require('object-assign');
var onetime = require('onetime');

module.exports = function (src, dest, opts, cb) {
	if (!src || !dest) {
		throw new Error('`src` and `dest` required');
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	cb = onetime(cb) || function () {};
	opts = objectAssign({overwrite: true}, opts);

	var read = fs.createReadStream(src);
	var readListener = onetime(startWrite);
	read.on('error', cb);
	read.on('readable', readListener);
	read.on('end', readListener);

	function startWrite() {
		mkdirp(path.dirname(dest), function (err) {
			if (err && err.code !== 'EEXIST') {
				cb(err);
				return;
			}

			var write = fs.createWriteStream(dest,
				{flags: opts.overwrite ? 'w' : 'wx'});

			write.on('error', function (err) {
				if (!opts.overwrite && err.code === 'EEXIST') {
					cb();
					return;
				}
				cb(err);
			});

			write.on('close', function () {
				fs.lstat(src, function (err, stats) {
					if (err) {
						cb(err);
						return;
					}

					fs.utimes(dest, stats.atime, stats.mtime, cb);
				});
			});

			read.pipe(write);
		});
	}
};

module.exports.sync = function (src, dest, opts) {
	if (!src || !dest) {
		throw new Error('`src` and `dest required');
	}

	opts = objectAssign({overwrite: true}, opts);

	var read = fs.openSync(src, 'r');
	var BUF_LENGTH = 100 * 1024;
	var buf = new Buffer(BUF_LENGTH);
	var bytesRead = fs.readSync(read, buf, 0, BUF_LENGTH, 0);

	try {
		mkdirp.sync(path.dirname(dest));
	} catch (err) {
		if (err.code !== 'EEXIST') {
			throw err;
		}
	}

	var write;
	try {
		write = fs.openSync(dest, opts.overwrite ? 'w' : 'wx');
	} catch (err) {
		if (!opts.overwrite && err.code === 'EEXIST') {
			return;
		}
	}
	fs.writeSync(write, buf, 0, bytesRead);

	var pos = bytesRead;
	while (bytesRead === BUF_LENGTH) {
		bytesRead = fs.readSync(read, buf, 0, BUF_LENGTH, pos);
		fs.writeSync(write, buf, 0, bytesRead);
		pos += bytesRead;
	}

	var stat = fs.fstatSync(read);
	fs.futimesSync(write, stat.atime, stat.mtime);
	fs.closeSync(read);
	fs.closeSync(write);
};
