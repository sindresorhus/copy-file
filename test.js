'use strict';
var assert = require('assert');
var fs = require('fs');
var cpFile = require('./');
var rimraf = require('rimraf');
var crypto = require('crypto');
var bufferCompare = Buffer.compare || require('buffer-compare');

/**
 * Tests equality of Date objects, w/o considering milliseconds.
 * @see {@link https://github.com/joyent/node/issues/7000|File timestamp resolution is inconsistent with fs.stat / fs.utimes}
 */
function assertDateEqual(actual, expected, message) {
	actual = new Date(actual);
	expected = new Date(expected);

	actual.setMilliseconds(0);
	expected.setMilliseconds(0);

	assert.equal(actual.getTime(), expected.getTime(), message);
}

function clean() {
	[
		'bigFile',
		'tmp',
		'EMPTY',
		'subdir',
	].forEach(function (path) {
		rimraf.sync(path);
	});
}

beforeEach(clean);

after(function () {
	if (!this.test.parent.bail()) {
		clean();
	}
});

describe('cpFile()', function () {

	it('should throw an Error on missing `src`', function() {
		assert.throws(cpFile.bind(cpFile), /`src`/);
	});

	it('should throw an Error on missing `dest`', function() {
		assert.throws(cpFile.bind(cpFile, 'TARGET'), /`dest`/);
	});

	it('should copy a file', function (cb) {
		cpFile('license', 'tmp', function (err) {
			assert(!err, err);
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
			cb();
		});
	});

	it('should copy an empty file', function (cb) {
		fs.writeFileSync('EMPTY', '');
		cpFile('EMPTY', 'tmp', function (err) {
			assert(!err, err);
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
			cb();
		});
	});

	it('should copy big files', function (cb) {
		var buf = crypto.pseudoRandomBytes(100 * 1024 * 3 + 1);

		fs.writeFileSync('bigFile', buf);
		cpFile('bigFile', 'tmp', function (err) {
			assert(!err, err);
			assert.strictEqual(bufferCompare(buf, fs.readFileSync('tmp')), 0);
			cb();
		});
	});

	it('should not alter overwrite option', function (cb) {
		var opts = {};

		cpFile('license', 'tmp', opts, function (err) {
			assert(!err, err);
			assert.strictEqual(opts.overwrite, undefined);
			cb();
		});
	});

	it('should overwrite when enabled', function (cb) {
		fs.writeFileSync('tmp', '');
		cpFile('license', 'tmp', {overwrite: true}, function (err) {
			assert(!err, err);
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
			cb();
		});
	});

	it('should overwrite options are undefined', function (cb) {
		fs.writeFileSync('tmp', '');
			cpFile('license', 'tmp', function (err) {
			assert(!err, err);
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
			cb();
		});
	});

	it('should not overwrite when disabled', function (cb) {
		fs.writeFileSync('tmp', '');
		cpFile('license', 'tmp', {overwrite: false}, function (err) {
			assert(!err, err);
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
			cb();
		});
	});

	it('should not create dest on unreadable src', function (cb) {
		cpFile('node_modules', 'tmp', function (err) {
			assert(err);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'EISDIR');
			assert.throws(fs.statSync.bind(fs, 'tmp'), /ENOENT/);
			cb();
		});
	});

	it('should not create dest directory on unreadable src', function (cb) {
		cpFile('node_modules', 'subdir/tmp', function (err) {
			assert(err);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'EISDIR');
			assert.throws(fs.statSync.bind(fs, 'subdir'), /ENOENT/);
			cb();
		});
	});

	it('should preserve timestamps', function (cb) {
		cpFile('license', 'tmp', function (err) {
			assert(!err, err);

			var licenseStats = fs.lstatSync('license');
			var tmpStats = fs.lstatSync('tmp');

			assertDateEqual(licenseStats.atime, tmpStats.atime);
			assertDateEqual(licenseStats.mtime, tmpStats.mtime);
			cb();
		});
	});

	it('should throw an Error if `src` does not exists', function (cb) {
		cpFile('NO_ENTRY', 'tmp', function (err) {
			assert(err);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'ENOENT');
			assert.strictEqual(/`NO_ENTRY`/.test(err.message), true, 'Error message does not contain path: ' + err.message);
			assert.strictEqual(/`NO_ENTRY`/.test(err.stack), true, 'Error stack does not contain path: ' + err.stack);
			cb();
		});
	});
});

describe('cpFile.sync()', function () {
	it('should throw an Error on missing `src`', function() {
		assert.throws(cpFile.sync.bind(cpFile), /`src`/);
	});

	it('should throw an Error on missing `dest`', function() {
		assert.throws(cpFile.sync.bind(cpFile, 'TARGET'), /`dest`/);
	});

	it('should copy a file', function () {
		cpFile.sync('license', 'tmp');
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
	});

	it('should copy an empty file', function () {
		fs.writeFileSync('EMPTY', '');
		cpFile.sync('EMPTY', 'tmp');
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
	});

	it('should copy big files', function () {
		var buf = crypto.pseudoRandomBytes(100 * 1024 * 3 + 1);

		fs.writeFileSync('bigFile', buf);
		cpFile.sync('bigFile', 'tmp');
		assert.strictEqual(bufferCompare(buf, fs.readFileSync('tmp')), 0);
	});

	it('should not alter overwrite option', function () {
		var opts = {};

		cpFile.sync('license', 'tmp', opts);
		assert.strictEqual(opts.overwrite, undefined);
	});

	it('should overwrite when enabled', function () {
		fs.writeFileSync('tmp', '');
		cpFile.sync('license', 'tmp', {overwrite: true});
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
	});

	it('should overwrite when options are undefined', function () {
		fs.writeFileSync('tmp', '');
		cpFile.sync('license', 'tmp');
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
	});

	it('should not overwrite when disabled', function () {
		fs.writeFileSync('tmp', '');
		cpFile.sync('license', 'tmp', {overwrite: false});
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
	});

	it('should not create dest on unreadable src', function () {
		try {
			cpFile.sync('node_modules', 'tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'EISDIR');
			assert.throws(fs.statSync.bind(fs, 'tmp'), /ENOENT/);
		}
	});

	it('should not create dest directory on unreadable src', function () {
		try {
			cpFile.sync('node_modules', 'subdir/tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'EISDIR');
			assert.throws(fs.statSync.bind(fs, 'subdir'), /ENOENT/);
		}
	});

	it('should preserve timestamps', function () {
		cpFile.sync('license', 'tmp');

		var licenseStats = fs.lstatSync('license');
		var tmpStats = fs.lstatSync('tmp');

		assertDateEqual(licenseStats.atime, tmpStats.atime);
		assertDateEqual(licenseStats.mtime, tmpStats.mtime);
	});

	it('should throw an Error if `src` does not exists', function () {
		try {
			cpFile.sync('NO_ENTRY', 'tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'ENOENT');
			assert.strictEqual(/`NO_ENTRY`/.test(err.message), true, 'Error message does not contain path: ' + err.message);
			assert.strictEqual(/`NO_ENTRY`/.test(err.stack), true, 'Error stack does not contain path: ' + err.stack);
		}
	});
});
