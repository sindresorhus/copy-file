'use strict';
var assert = require('assert');
var fs = require('fs');
var cpFile = require('./');
var rimraf = require('rimraf');

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
			assert(err.cause().code === 'EISDIR');
			assert.throws(fs.statSync.bind(fs, 'tmp'), /ENOENT/);
			cb();
		});
	});

	it('should not create dest directory on unreadable src', function (cb) {
		cpFile('node_modules', 'subdir/tmp', function (err) {
			assert(err);
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
});

describe('cpFile.sync()', function () {
	it('should copy a file', function () {
		cpFile.sync('license', 'tmp');
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
	});

	it('should copy an empty file', function () {
		fs.writeFileSync('EMPTY', '');
		cpFile.sync('EMPTY', 'tmp');
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
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
		assert.throws(cpFile.sync.bind(cpFile, 'node_modules', 'tmp'), /EISDIR/);
		assert.throws(fs.statSync.bind(fs, 'tmp'), /ENOENT/);
	});

	it('should not create dest directory on unreadable src', function () {
		assert.throws(cpFile.sync.bind(cpFile, 'node_modules', 'subdir/tmp'));
		assert.throws(fs.statSync.bind(fs, 'subdir'), /ENOENT/);
	});

	it('should preserve timestamps', function () {
		cpFile.sync('license', 'tmp');
		var licenseStats = fs.lstatSync('license');
		var tmpStats = fs.lstatSync('tmp');
		assertDateEqual(licenseStats.atime, tmpStats.atime);
		assertDateEqual(licenseStats.mtime, tmpStats.mtime);
	});
});
