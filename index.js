'use strict';
var path = require('path');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');

module.exports = function (src, dest, opts, cb) {
	if (!src || !dest) {
		throw new Error('`src` and `dest` required');
	}

	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	opts.overwrite = opts.overwrite === undefined ? true : false;
	cb = cb || function () {};

	var cbCalled = false;

	function done(err) {
		if (cbCalled) {
			return;
		}

		cbCalled = true;
		cb(err);
	}

	function copy() {
		mkdirp(path.dirname(dest), function (err) {
			if (err && err.code !== 'EEXIST') {
				cb(err);
				return;
			}

			var read = fs.createReadStream(src);
			var write = fs.createWriteStream(dest);

			read.on('error', done);
			write.on('error', done);
			write.on('close', done);

			read.pipe(write);
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

	opts = opts || {};
	opts.overwrite = opts.overwrite === undefined ? true : false;

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
	var write = fs.openSync(dest, 'w');
	var bytesRead = BUF_LENGTH;
	var pos = 0;

	while (bytesRead === BUF_LENGTH) {
		bytesRead = fs.readSync(read, buf, 0, BUF_LENGTH, pos);
		fs.writeSync(write, buf, 0, bytesRead);
		pos += bytesRead;
	}

	fs.closeSync(read);
	fs.closeSync(write);
};
