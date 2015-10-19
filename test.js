/* eslint-env mocha */
'use strict';
var Promise = require('pinkie-promise');
var pify = require('pify');
var assert = require('assert');
var fs = require('fs');
var fsP = pify.all(fs, Promise);
var cpFile = require('./');
var rimraf = require('rimraf');
var crypto = require('crypto');
var bufferEquals = require('buffer-equals');
var rewire = require('rewire');
var objectAssign = require('object-assign');

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
		'subdir'
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
	it('should reject an Error on missing `src`', function () {
		return cpFile().then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert(err);
			assert(/`src`/.test(err));
		});
	});

	it('should reject an Error on missing `dest`', function () {
		return cpFile('TARGET').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert(err);
			assert(/`dest`/.test(err));
		});
	});

	it('should copy a file', function () {
		return cpFile('license', 'tmp').then(function () {
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
		});
	});

	it('should copy an empty file', function () {
		fs.writeFileSync('EMPTY', '');
		return cpFile('EMPTY', 'tmp').then(function () {
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
		});
	});

	it('should copy big files', function () {
		var buf = crypto.pseudoRandomBytes(100 * 1024 * 3 + 1);

		fs.writeFileSync('bigFile', buf);
		return cpFile('bigFile', 'tmp').then(function () {
			assert.strictEqual(bufferEquals(buf, fs.readFileSync('tmp')), true);
		});
	});

	it('should not alter overwrite option', function () {
		var opts = {};

		return cpFile('license', 'tmp', opts).then(function () {
			assert.strictEqual(opts.overwrite, undefined);
		});
	});

	it('should overwrite when enabled', function () {
		fs.writeFileSync('tmp', '');
		return cpFile('license', 'tmp', {overwrite: true}).then(function () {
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
		});
	});

	it('should overwrite options are undefined', function () {
		fs.writeFileSync('tmp', '');
		return cpFile('license', 'tmp').then(function () {
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
		});
	});

	it('should not overwrite when disabled', function () {
		fs.writeFileSync('tmp', '');
		return cpFile('license', 'tmp', {overwrite: false}).then(function () {
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), '');
		});
	});

	it('should not create dest on unreadable src', function () {
		return cpFile('node_modules', 'tmp').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert(err);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'EISDIR');
			assert.throws(fs.statSync.bind(fs, 'tmp'), /ENOENT/);
		});
	});

	it('should not create dest directory on unreadable src', function () {
		return cpFile('node_modules', 'subdir/tmp').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert(err);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'EISDIR');
			assert.throws(fs.statSync.bind(fs, 'subdir'), /ENOENT/);
		});
	});

	it('should preserve timestamps', function () {
		return cpFile('license', 'tmp').then(function () {
			var licenseStats = fs.lstatSync('license');
			var tmpStats = fs.lstatSync('tmp');

			assertDateEqual(licenseStats.atime, tmpStats.atime);
			assertDateEqual(licenseStats.mtime, tmpStats.mtime);
		});
	});

	it('should throw an Error if `src` does not exists', function () {
		return cpFile('NO_ENTRY', 'tmp').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert(err);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'ENOENT');
			assert.strictEqual(/`NO_ENTRY`/.test(err.message), true, 'Error message does not contain path: ' + err.message);
			assert.strictEqual(/`NO_ENTRY`/.test(err.stack), true, 'Error stack does not contain path: ' + err.stack);
		});
	});

	it('should rethrow mkdirp EACCES errors', function () {
		var sut = rewire('./');
		var dirPath = '/root/NO_ACCESS';
		var mkdirError = new Error('EACCES, permission denied \'' + dirPath + '\'');
		var called = 0;

		mkdirError.errno = -13;
		mkdirError.code = 'EACCES';
		mkdirError.path = dirPath;

		sut.__set__('mkdirpP', function () {
			called++;
			return new Promise(function (resolve, reject) {
				reject(mkdirError);
			});
		});

		return sut('license', dirPath + '/tmp').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert.ok(err);
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.errno, mkdirError.errno);
			assert.strictEqual(err.code, mkdirError.code);
			assert.strictEqual(err.path, mkdirError.path);
		});
	});

	it('should ignore mkdirp EEXIST errors', function () {
		var sut = rewire('./');
		var dirPath = '/root/NO_ACCESS';
		var mkdirError = new Error('EEXIST, mkdir \'' + dirPath + '\'');
		var called = 0;

		mkdirError.errno = -17;
		mkdirError.code = 'EEXIST';
		mkdirError.path = dirPath;

		sut.__set__('mkdirpP', function () {
			called++;
			return new Promise(function (resolve, reject) {
				reject(mkdirError);
			});
		});

		return sut('license', 'tmp').then(function () {
			assert.strictEqual(called, 1);
			assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
		});
	});

	it('should rethrow ENOSPC errors', function () {
		var sut = rewire('./');
		var noSpaceError = new Error('ENOSPC, write');
		var called = false;

		noSpaceError.errno = -28;
		noSpaceError.code = 'ENOSPC';

		sut.__set__('fs', objectAssign({}, fs, {
			createWriteStream: function (path, options) {
				var stream = fs.createWriteStream(path, options);
				stream.on('pipe', function () {
					if (!called) {
						called = true;
						stream.emit('error', noSpaceError);
					}
				});
				return stream;
			}
		}));

		return sut('license', 'tmp').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert.ok(err);
			assert.strictEqual(called, true);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.errno, noSpaceError.errno);
			assert.strictEqual(err.code, noSpaceError.code);
		});
	});

	it('should rethrow stat errors', function () {
		var sut = rewire('./');
		var called = 0;

		sut.__set__('fsP', objectAssign({}, fsP, {
			lstat: function () {
				called++;
				// reject Error:
				return fsP.lstat(crypto.randomBytes(64).toString('hex'));
			}
		}));

		return sut('license', 'tmp').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert.ok(err);
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'ENOENT');
		});
	});

	it('should rethrow utimes errors', function () {
		var sut = rewire('./');
		var called = 0;

		sut.__set__('fsP', objectAssign({}, fsP, {
			utimes: function (path, atime, mtime) {
				called++;
				// reject Error:
				return fsP.utimes(crypto.randomBytes(64).toString('hex'), atime, mtime);
			}
		}));

		return sut('license', 'tmp').then(function () {
			assert.fail(undefined, Error, 'Missing expected exception');
		}, function (err) {
			assert.ok(err);
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'ENOENT');
		});
	});
});

describe('cpFile.sync()', function () {
	it('should throw an Error on missing `src`', function () {
		assert.throws(cpFile.sync.bind(cpFile), /`src`/);
	});

	it('should throw an Error on missing `dest`', function () {
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
		assert.strictEqual(bufferEquals(buf, fs.readFileSync('tmp')), true);
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

	it('should rethrow mkdirp EACCES errors', function () {
		var sut = rewire('./');
		var dirPath = '/root/NO_ACCESS';
		var mkdirError = new Error('EACCES, permission denied \'' + dirPath + '\'');
		var called = 0;

		mkdirError.errno = -13;
		mkdirError.code = 'EACCES';
		mkdirError.path = dirPath;

		sut.__set__('mkdirp', {
			sync: function () {
				called++;
				throw mkdirError;
			}
		});

		try {
			sut.sync('license', dirPath + '/tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.errno, mkdirError.errno);
			assert.strictEqual(err.code, mkdirError.code);
			assert.strictEqual(err.path, mkdirError.path);
		}
	});

	it('should ignore mkdirp EEXIST errors', function () {
		var sut = rewire('./');
		var dirPath = '/root/NO_ACCESS';
		var mkdirError = new Error('EEXIST, mkdir \'' + dirPath + '\'');
		var called = 0;

		mkdirError.errno = -17;
		mkdirError.code = 'EEXIST';
		mkdirError.path = dirPath;

		sut.__set__('mkdirp', {
			sync: function () {
				called++;
				throw mkdirError;
			}
		});

		sut.sync('license', 'tmp');
		assert.strictEqual(called, 1);
		assert.strictEqual(fs.readFileSync('tmp', 'utf8'), fs.readFileSync('license', 'utf8'));
	});

	it('should rethrow ENOSPC errors', function () {
		var sut = rewire('./');
		var noSpaceError = new Error('ENOSPC, write');
		var called = 0;

		noSpaceError.errno = -28;
		noSpaceError.code = 'ENOSPC';

		sut.__set__('fs', objectAssign({}, fs, {
			writeSync: function () {
				called++;
				// throw Error:
				throw noSpaceError;
			}
		}));

		try {
			sut.sync('license', 'tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.errno, noSpaceError.errno);
			assert.strictEqual(err.code, noSpaceError.code);
		}
	});

	it('should rethrow EACCES errors of dest', function () {
		var sut = rewire('./');
		var dirPath = '/root/NO_ACCESS';
		var openError = new Error('EACCES, permission denied \'' + dirPath + '\'');
		var called = 0;

		openError.errno = -13;
		openError.code = 'EACCES';
		openError.path = dirPath;

		sut.__set__('fs', objectAssign({}, fs, {
			openSync: function (path, flags, mode) {
				if (path === 'tmp') {
					called++;
					// throw Error:
					throw openError;
				} else {
					return fs.openSync(path, flags, mode);
				}
			}
		}));

		try {
			sut.sync('license', 'tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.errno, openError.errno);
			assert.strictEqual(err.code, openError.code);
			assert.strictEqual(err.path, openError.path);
		}
	});

	it('should rethrow stat errors', function () {
		var sut = rewire('./');
		var called = 0;

		sut.__set__('fs', objectAssign({}, fs, {
			fstatSync: function () {
				called++;
				// throw Error:
				return fs.statSync(crypto.randomBytes(64).toString('hex'));
			}
		}));

		try {
			sut.sync('license', 'tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'ENOENT');
		}
	});

	it('should rethrow utimes errors', function () {
		var sut = rewire('./');
		var called = 0;

		sut.__set__('fs', objectAssign({}, fs, {
			futimesSync: function (path, atime, mtime) {
				called++;
				// throw Error:
				return fs.utimesSync(crypto.randomBytes(64).toString('hex'), atime, mtime);
			}
		}));

		try {
			sut.sync('license', 'tmp');
			assert.fail(undefined, Error, 'Missing expected exception');
		} catch (err) {
			assert.strictEqual(called, 1);
			assert.strictEqual(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
			assert.strictEqual(err.code, 'ENOENT');
		}
	});
});
