'use strict';
var assert = require('assert');
var fs = require('fs');
var cpFile = require('./');

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
});
