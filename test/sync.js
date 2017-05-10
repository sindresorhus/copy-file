import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import del from 'del';
import test from 'ava';
import uuid from 'uuid';
import m from '..';
import assertDateEqual from './helpers/assert';
import {buildEACCES, buildENOSPC, buildEBADF} from './helpers/fs-errors';

const THREE_HUNDRED_KILO = (100 * 3 * 1024) + 1;

test.before(() => {
	process.chdir(path.dirname(__dirname));
});

test.beforeEach(t => {
	t.context.src = uuid.v4();
	t.context.dest = uuid.v4();
	t.context.creates = [t.context.src, t.context.dest];
});

test.afterEach.always(t => {
	t.context.creates.forEach(path => del.sync(path));
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
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'EISDIR', err);
	t.throws(() => fs.statSync(t.context.dest), /ENOENT/);
});

test('do not create dest directory on unreadable src', t => {
	const err = t.throws(() => m.sync('node_modules', 'subdir/' + uuid.v4()));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'EISDIR', err);
	t.throws(() => fs.statSync('subdir'), /ENOENT/);
});

test('preserve timestamps', t => {
	m.sync('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	assertDateEqual(t, licenseStats.atime, tmpStats.atime);
	assertDateEqual(t, licenseStats.mtime, tmpStats.mtime);
});

test('throw an Error if `src` does not exists', t => {
	const err = t.throws(() => m.sync('NO_ENTRY', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'ENOENT', err);
	t.regex(err.message, /`NO_ENTRY`/, err);
	t.regex(err.stack, /`NO_ENTRY`/, err);
});

test('rethrow mkdirp EACCES errors', t => {
	const mkdirSync = fs.mkdirSync;
	const dirPath = '/root/NO_ACCESS_' + uuid.v4();
	const dest = dirPath + '/' + uuid.v4();
	const mkdirError = buildEACCES(dirPath);
	let called = 0;

	fs.mkdirSync = (path, mode) => {
		if (path === dirPath) {
			called++;
			throw mkdirError;
		}

		return mkdirSync(path, mode);
	};

	const err = t.throws(() => m.sync('license', dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, mkdirError.errno, err);
	t.is(err.code, mkdirError.code, err);
	t.is(err.path, mkdirError.path, err);
	t.is(called, 1);
});

test('rethrow ENOSPC errors', t => {
	const openSync = fs.openSync;
	const writeSync = fs.writeSync;
	const fds = new Map();
	const noSpaceError = buildENOSPC();
	let called = 0;

	fs.writeFileSync(t.context.src, '');
	fs.openSync = (path, flags, mode) => {
		const fd = openSync(path, flags, mode);
		fds.set(fd, path);
		return fd;
	};
	// eslint-disable-next-line max-params
	fs.writeSync = (fd, buffer, offset, length, position) => {
		if (fds.get(fd) === t.context.dest) {
			called++;
			// Throw Error:
			throw noSpaceError;
		}

		return writeSync(fd, buffer, offset, length, position);
	};

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, noSpaceError.errno, err);
	t.is(err.code, noSpaceError.code, err);
	t.is(called, 1);
});

test('rethrow stat errors', t => {
	const openSync = fs.openSync;
	const fstatSync = fs.fstatSync;
	const fstatError = buildEBADF();
	const fds = new Map();
	let called = 0;

	fs.writeFileSync(t.context.src, '');
	fs.openSync = (path, flags, mode) => {
		const fd = openSync(path, flags, mode);
		fds.set(fd, path);
		return fd;
	};
	fs.fstatSync = fd => {
		if (fds.get(fd) === t.context.src) {
			called++;
			throw fstatError;
		}

		return fstatSync(fd);
	};

	const err = t.throws(() => m.sync(t.context.src, t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, fstatError.errno, err);
	t.is(err.code, fstatError.code, err);
	t.is(called, 1);
});

test('rethrow utimes errors', t => {
	const openSync = fs.openSync;
	const futimesSync = fs.futimesSync;
	const futimesError = buildEBADF();
	const fds = new Map();
	let called = 0;

	fs.openSync = (path, flags, mode) => {
		const fd = openSync(path, flags, mode);
		fds.set(fd, path);
		return fd;
	};
	fs.futimesSync = (fd, atime, mtime) => {
		if (fds.get(fd) === t.context.dest) {
			called++;
			throw futimesError;
		}

		return futimesSync(path, atime, mtime);
	};

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, futimesError.errno, err);
	t.is(err.code, futimesError.code, err);
	t.is(called, 1);
});

test('rethrow EACCES errors of dest', t => {
	const openSync = fs.openSync;
	const openError = buildEACCES(t.context.dest);
	let called = 0;

	fs.openSync = (path, flags, mode) => {
		if (path === t.context.dest) {
			called++;
			throw openError;
		}

		return openSync(path, flags, mode);
	};

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, openError.errno, err);
	t.is(err.code, openError.code, err);
	t.is(err.path, openError.path, err);
	t.is(called, 1);
});
