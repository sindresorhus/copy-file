import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import importFresh from 'import-fresh';
import clearModule from 'clear-module';
import del from 'del';
import test from 'ava';
import uuid from 'uuid';
import sinon from 'sinon';
import cpFile from '..';
import assertDateEqual from './helpers/assert';
import {buildEACCES, buildENOSPC, buildENOENT, buildEPERM} from './helpers/fs-errors';

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
	await t.throwsAsync(() => cpFile(), /`src`/);
});

test('reject an Error on missing `dest`', async t => {
	await t.throwsAsync(() => cpFile('TARGET'), /`dest`/);
});

test('copy a file', async t => {
	await cpFile('license', t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('copy an empty file', async t => {
	fs.writeFileSync(t.context.src, '');
	await cpFile(t.context.src, t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), '');
});

test('copy big files', async t => {
	const buf = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.src, buf);
	await cpFile(t.context.src, t.context.dest);
	t.true(buf.equals(fs.readFileSync(t.context.dest)));
});

test('do not alter overwrite option', async t => {
	const opts = {};
	await cpFile('license', t.context.dest, opts);
	t.false('overwrite' in opts);
});

test('overwrite when enabled', async t => {
	fs.writeFileSync(t.context.dest, '');
	await cpFile('license', t.context.dest, {overwrite: true});
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('overwrite when options are undefined', async t => {
	fs.writeFileSync(t.context.dest, '');
	await cpFile('license', t.context.dest);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('do not overwrite when disabled', async t => {
	fs.writeFileSync(t.context.dest, '');
	await cpFile('license', t.context.dest, {overwrite: false});
	t.is(fs.readFileSync(t.context.dest, 'utf8'), '');
});

test('do not create dest on unreadable src', async t => {
	const err = await t.throwsAsync(() => cpFile('node_modules', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'EISDIR', err);
	t.throws(() => fs.statSync(t.context.dest), /ENOENT/);
});

test('do not create dest directory on unreadable src', async t => {
	const err = await t.throwsAsync(() => cpFile('node_modules', 'subdir/' + uuid.v4()));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'EISDIR', err);
	t.throws(() => fs.statSync('subdir'), /ENOENT/);
});

test('preserve timestamps', async t => {
	await cpFile('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	assertDateEqual(t, licenseStats.atime, tmpStats.atime);
	assertDateEqual(t, licenseStats.mtime, tmpStats.mtime);
});

test('preserve mode', async t => {
	await cpFile('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	t.is(licenseStats.mode, tmpStats.mode);
});

test('preserve ownership', async t => {
	await cpFile('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	t.is(licenseStats.gid, tmpStats.gid);
	t.is(licenseStats.uid, tmpStats.uid);
});

test('throw an Error if `src` does not exists', async t => {
	const err = await t.throwsAsync(() => cpFile('NO_ENTRY', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'ENOENT', err);
	t.regex(err.message, /`NO_ENTRY`/, err);
	t.regex(err.stack, /`NO_ENTRY`/, err);
});

test.serial('rethrow mkdir EACCES errors', async t => {
	const dirPath = '/root/NO_ACCESS_' + uuid.v4();
	const dest = dirPath + '/' + uuid.v4();
	const mkdirError = buildEACCES(dirPath);

	fs.mkdir = sinon.stub(fs, 'mkdir').throws(mkdirError);

	const err = await t.throwsAsync(() => cpFile('license', dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, mkdirError.errno, err);
	t.is(err.code, mkdirError.code, err);
	t.is(err.path, mkdirError.path, err);
	t.true(fs.mkdir.called);

	fs.mkdir.restore();
});

test.serial('rethrow ENOSPC errors', async t => {
	const {createWriteStream} = fs;
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

	clearModule('../fs');
	const uncached = importFresh('..');
	const err = await t.throwsAsync(() => uncached('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, noSpaceError.errno, err);
	t.is(err.code, noSpaceError.code, err);
	t.true(called);
});

test.serial('rethrow stat errors', async t => {
	const fstatError = buildENOENT();

	fs.writeFileSync(t.context.src, '');
	fs.lstat = sinon.stub(fs, 'lstat').throws(fstatError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const err = await t.throwsAsync(() => uncached(t.context.src, t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, fstatError.errno, err);
	t.is(err.code, fstatError.code, err);
	t.true(fs.lstat.called);

	fs.lstat.restore();
});

test.serial('rethrow utimes errors', async t => {
	const utimesError = buildENOENT();

	fs.utimes = sinon.stub(fs, 'utimes').throws(utimesError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const err = await t.throwsAsync(() => uncached('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'ENOENT', err);
	t.true(fs.utimes.called);

	fs.utimes.restore();
});

test.serial('rethrow chmod errors', async t => {
	const chmodError = buildEPERM(t.context.dest, 'chmod');

	fs.chmod = sinon.stub(fs, 'chmod').throws(chmodError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const err = await t.throwsAsync(() => uncached('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, chmodError.code, err);
	t.is(err.path, chmodError.path, err);
	t.true(fs.chmod.called);

	fs.chmod.restore();
});

test.serial('rethrow chown errors', async t => {
	const chownError = buildEPERM(t.context.dest, 'chown');

	fs.chown = sinon.stub(fs, 'chown').throws(chownError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const err = await t.throwsAsync(() => uncached('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, chownError.code, err);
	t.is(err.path, chownError.path, err);
	t.true(fs.chown.called);

	fs.chown.restore();
});
