import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import requireUncached from 'require-uncached';
import clearRequire from 'clear-require';
import del from 'del';
import test from 'ava';
import uuid from 'uuid';
import m from '..';
import assertDateEqual from './helpers/assert';
import {buildEACCES, buildENOSPC, buildENOENT} from './helpers/fs-errors';

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

test('reject an Error on missing `src`', async t => {
	await t.throws(m(), /`src`/);
});

test('reject an Error on missing `dest`', async t => {
	await t.throws(m('TARGET'), /`dest`/);
});

test('copy a file', async t => {
	await m('license', t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('copy an empty file', async t => {
	fs.writeFileSync(t.context.src, '');
	await m(t.context.src, t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), '');
});

test('copy big files', async t => {
	const buf = crypto.pseudoRandomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.src, buf);
	await m(t.context.src, t.context.dest);
	t.true(buf.equals(fs.readFileSync(t.context.dest)));
});

test('do not alter overwrite option', async t => {
	const opts = {};
	await m('license', t.context.dest, opts);
	t.false('overwrite' in opts);
});

test('overwrite when enabled', async t => {
	fs.writeFileSync(t.context.dest, '');
	await m('license', t.context.dest, {overwrite: true});
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('overwrite when options are undefined', async t => {
	fs.writeFileSync(t.context.dest, '');
	await m('license', t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('do not overwrite when disabled', async t => {
	fs.writeFileSync(t.context.dest, '');
	await m('license', t.context.dest, {overwrite: false});
	t.is(fs.readFileSync(t.context.dest, 'utf8'), '');
});

test('do not create dest on unreadable src', async t => {
	const err = await t.throws(m('node_modules', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'EISDIR', err);
	t.throws(() => fs.statSync(t.context.dest), /ENOENT/);
});

test('do not create dest directory on unreadable src', async t => {
	const err = await t.throws(m('node_modules', 'subdir/' + uuid.v4()));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'EISDIR', err);
	t.throws(() => fs.statSync('subdir'), /ENOENT/);
});

test('preserve timestamps', async t => {
	await m('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	assertDateEqual(t, licenseStats.atime, tmpStats.atime);
	assertDateEqual(t, licenseStats.mtime, tmpStats.mtime);
});

test('throw an Error if `src` does not exists', async t => {
	const err = await t.throws(m('NO_ENTRY', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'ENOENT', err);
	t.regex(err.message, /`NO_ENTRY`/, err);
	t.regex(err.stack, /`NO_ENTRY`/, err);
});

test('rethrow mkdirp EACCES errors', async t => {
	const mkdir = fs.mkdir;
	const dirPath = '/root/NO_ACCESS_' + uuid.v4();
	const dest = dirPath + '/' + uuid.v4();
	const mkdirError = buildEACCES(dirPath);
	let called = 0;

	fs.mkdir = (path, mode, cb) => {
		if (path === dirPath) {
			called++;
			cb(mkdirError);
			return;
		}

		mkdir(path, mode, cb);
	};

	const err = await t.throws(m('license', dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, mkdirError.errno, err);
	t.is(err.code, mkdirError.code, err);
	t.is(err.path, mkdirError.path, err);
	t.is(called, 1);
});

test('rethrow ENOSPC errors', async t => {
	const createWriteStream = fs.createWriteStream;
	const noSpaceError = buildENOSPC();
	let called = false;

	fs.createWriteStream = (path, options) => {
		const stream = createWriteStream(path, options);
		if (path === t.context.dest) {
			stream.on('pipe', () => {
				if (!called) {
					called = true;
					stream.emit('error', noSpaceError);
				}
			});
		}
		return stream;
	};

	clearRequire('../fs');
	const uncached = requireUncached('..');
	const err = await t.throws(uncached('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, noSpaceError.errno, err);
	t.is(err.code, noSpaceError.code, err);
	t.true(called);
});

test('rethrow stat errors', async t => {
	const lstat = fs.lstat;
	const fstatError = buildENOENT();
	let called = 0;

	fs.writeFileSync(t.context.src, '');
	fs.lstat = (path, cb) => {
		if (path === t.context.src) {
			called++;
			cb(fstatError);
			return;
		}

		lstat(path, cb);
	};

	clearRequire('../fs');
	const uncached = requireUncached('..');
	const err = await t.throws(uncached(t.context.src, t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, fstatError.errno, err);
	t.is(err.code, fstatError.code, err);
	t.is(called, 1);
});

test('rethrow utimes errors', async t => {
	const utimes = fs.utimes;
	const utimesError = buildENOENT();
	let called = 0;

	fs.utimes = (path, atime, mtime, cb) => {
		if (path === t.context.dest) {
			called++;
			cb(utimesError);
			return;
		}

		utimes(path, atime, mtime, cb);
	};

	clearRequire('../fs');
	const uncached = requireUncached('..');
	const err = await t.throws(uncached('license', t.context.dest));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'ENOENT', err);
});
