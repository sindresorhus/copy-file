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

	function copy() {
		mkdirp(path.dirname(dest), function (err) {
			if (err && err.code !== 'EEXIST') {
				cb(err);
				return;
			}

			var read = fs.createReadStream(src);
			read.on('error', cb);
			read.on('readable', onetime(onReadable));

			function onReadable() {
				var write = fs.createWriteStream(dest);

				write.on('error', cb);
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
			}
		});
	}

	if (opts.overwrite) {
		copy();
	} else {
		fs.exists(dest, function (exists) {
			if (exists) {
				cb();
				return;
			}

			copy();
		});
	}
};

module.exports.sync = function (src, dest, opts) {
	if (!src || !dest) {
		throw new Error('`src` and `dest required');
	}

	opts = objectAssign({overwrite: true}, opts);

	if (!opts.overwrite && fs.existsSync(dest)) {
		return;
	}

	try {
		mkdirp.sync(path.dirname(dest));
	} catch (err) {
		if (err.code !== 'EEXIST') {
			throw err;
		}
	}

	var BUF_LENGTH = 100 * 1024;
	var buf = new Buffer(BUF_LENGTH);
	var read = fs.openSync(src, 'r');
	var bytesRead = fs.readSync(read, buf, 0, BUF_LENGTH, 0);
	var write = fs.openSync(dest, 'w');
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
