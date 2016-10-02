import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rewire from 'rewire';
import rimraf from 'rimraf';
import test from 'ava';
import uuid from 'uuid';
import m from '../';
import {assertDateEqual} from './_assert';

const THREE_HUNDRED_KILO = (100 * 3 * 1024) + 1;

test.before(() => {
	process.chdir(path.dirname(__dirname));
});

test.beforeEach(t => {
	const src = t.context.src = uuid.v4();
	const dest = t.context.dest = uuid.v4();
	t.context.creates = [src, dest];
});

test.afterEach.always(t => {
	t.context.creates.forEach(path => rimraf.sync(path));
});

test('throw an Error on missing `src`', t => {
	t.throws(() => m.sync(), /`src`/);
});

test('throw an Error on missing `dest`', t => {
	t.throws(() => m.sync('TARGET'), /`dest`/);
});

test('copy a file', t => {
	m.sync('license', t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('copy an empty file', t => {
	fs.writeFileSync(t.context.src, '');
	m.sync(t.context.src, t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), '');
});

test('copy big files', t => {
	const buf = crypto.pseudoRandomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.src, buf);
	m.sync(t.context.src, t.context.dest);
	t.true(buf.equals(fs.readFileSync(t.context.dest)));
});

test('do not alter overwrite option', t => {
	const opts = {};
	m.sync('license', t.context.dest, opts);
	t.false('overwrite' in opts);
});

test('overwrite when enabled', t => {
	fs.writeFileSync(t.context.dest, '');
	m.sync('license', t.context.dest, {overwrite: true});
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('overwrite when options are undefined', t => {
	fs.writeFileSync(t.context.dest, '');
	m.sync('license', t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('do not overwrite when disabled', t => {
	fs.writeFileSync(t.context.dest, '');
	m.sync('license', t.context.dest, {overwrite: false});
	t.is(fs.readFileSync(t.context.dest, 'utf8'), '');
});

test('do not create dest on unreadable src', t => {
	const err = t.throws(() => m.sync('node_modules', t.context.dest));
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'EISDIR');
	t.throws(() => fs.statSync(t.context.dest), /ENOENT/);
});

test('do not create dest directory on unreadable src', t => {
	const err = t.throws(() => m.sync('node_modules', 'subdir/tmp'));
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'EISDIR');
	t.throws(() => fs.statSync('subdir'), /ENOENT/);
});

test('preserve timestamps', t => {
	m.sync('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	assertDateEqual(licenseStats.atime, tmpStats.atime);
	assertDateEqual(licenseStats.mtime, tmpStats.mtime);
});

test('throw an Error if `src` does not exists', t => {
	const err = t.throws(() => m.sync('NO_ENTRY', t.context.dest));
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'ENOENT');
	t.regex(err.message, /`NO_ENTRY`/);
	t.regex(err.stack, /`NO_ENTRY`/);
});

test('rethrow mkdirp EACCES errors', t => {
	const sut = rewire('../');
	const dirPath = '/root/NO_ACCESS';
	const mkdirError = new Error(`EACCES, permission denied '${dirPath}'`);
	let called = 0;

	mkdirError.errno = -13;
	mkdirError.code = 'EACCES';
	mkdirError.path = dirPath;

	sut.__set__('mkdirp', {
		sync: () => {
			called++;
			throw mkdirError;
		}
	});

	const err = t.throws(() => sut.sync('license', dirPath + '/tmp'));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.errno, mkdirError.errno);
	t.is(err.code, mkdirError.code);
	t.is(err.path, mkdirError.path);
});

test('ignore mkdirp EEXIST errors', t => {
	const sut = rewire('../');
	const dirPath = '/root/NO_ACCESS';
	const mkdirError = new Error(`EEXIST, mkdir '${dirPath}'`);
	let called = 0;

	mkdirError.errno = -17;
	mkdirError.code = 'EEXIST';
	mkdirError.path = dirPath;

	sut.__set__('mkdirp', {
		sync: () => {
			called++;
			throw mkdirError;
		}
	});

	sut.sync('license', t.context.dest);
	t.is(called, 1);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('rethrow ENOSPC errors', t => {
	const sut = rewire('../');
	const noSpaceError = new Error('ENOSPC, write');
	let called = false;

	noSpaceError.errno = -28;
	noSpaceError.code = 'ENOSPC';

	sut.__set__('fs', Object.assign({}, fs, {
		writeSync: () => {
			called = true;
			throw noSpaceError;
		}
	}));

	const err = t.throws(() => sut.sync('license', t.context.dest));
	t.true(called);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.errno, noSpaceError.errno);
	t.is(err.code, noSpaceError.code);
});

test('rethrow stat errors', t => {
	const sut = rewire('../');
	let called = 0;

	sut.__set__('fs', Object.assign({}, fs, {
		fstatSync: () => {
			called++;

			// throw Error:
			return fs.statSync(uuid.v4());
		}
	}));

	const err = t.throws(() => sut.sync('license', t.context.dest));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'ENOENT');
});

test('rethrow utimes errors', t => {
	const sut = rewire('../');
	let called = 0;

	sut.__set__('fs', Object.assign({}, fs, {
		futimesSync: (path, atime, mtime) => {
			called++;

			// throw Error:
			return fs.utimesSync(uuid.v4(), atime, mtime);
		}
	}));

	const err = t.throws(() => sut.sync('license', t.context.dest));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'ENOENT');
});

test('rethrow EACCES errors of dest', async t => {
	const sut = rewire('../');
	const dirPath = '/root/NO_ACCESS';
	const openError = new Error(`EACCES, permission denied '${dirPath}'`);
	let called = 0;

	openError.errno = -13;
	openError.code = 'EACCES';
	openError.path = dirPath;

	sut.__set__('fs', Object.assign({}, fs, {
		openSync: (path, flags, mode) => {
			if (path === t.context.dest) {
				called++;
				throw openError;
			}

			return fs.openSync(path, flags, mode);
		}
	}));

	const err = t.throws(() => sut.sync('license', t.context.dest));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.errno, openError.errno);
	t.is(err.code, openError.code);
	t.is(err.path, openError.path);
});
