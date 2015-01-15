'use strict';
var assert = require('assert');
var fs = require('fs');
var cpFile = require('./');

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

afterEach(function () {
	try {
		fs.unlinkSync('tmp');
	} catch (err) {}
});

describe('cpFile()', function () {
	it('should copy a file', function (cb) {
		cpFile('license', 'tmp', function (err) {
			assert(!err, err);
			assert.strictEqual(fs.readFileSync('license', 'utf8'), fs.readFileSync('tmp', 'utf8'));
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
		assert.strictEqual(fs.readFileSync('license', 'utf8'), fs.readFileSync('tmp', 'utf8'));
	});

	it('should not overwrite when disabled', function () {
		fs.writeFileSync('tmp', '');
		cpFile.sync('license', 'tmp', {overwrite: false});
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
	});

	it('should preserve timestamps', function () {
		cpFile.sync('license', 'tmp');
		var licenseStats = fs.lstatSync('license');
		var tmpStats = fs.lstatSync('tmp');
		assertDateEqual(licenseStats.atime, tmpStats.atime);
		assertDateEqual(licenseStats.mtime, tmpStats.mtime);
	});
});
