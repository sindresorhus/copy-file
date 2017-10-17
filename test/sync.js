import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import del from 'del';
import test from 'ava';
import uuid from 'uuid';
import sinon from 'sinon';
import m from '..';
import assertDateEqual from './helpers/assert';
import {buildEACCES, buildENOSPC, buildEBADF, buildEPERM} from './helpers/fs-errors';

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

test('preserve mode', t => {
	m.sync('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	t.is(licenseStats.mode, tmpStats.mode);
});

test('preserve ownership', t => {
	m.sync('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	t.is(licenseStats.gid, tmpStats.gid);
	t.is(licenseStats.uid, tmpStats.uid);
});

test('throw an Error if `src` does not exists', t => {
	const err = t.throws(() => m.sync('NO_ENTRY', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.code, 'ENOENT', err);
	t.regex(err.message, /`NO_ENTRY`/, err);
	t.regex(err.stack, /`NO_ENTRY`/, err);
});

test('rethrow mkdir EACCES errors', t => {
	const dirPath = '/root/NO_ACCESS_' + uuid.v4();
	const dest = dirPath + '/' + uuid.v4();
	const mkdirError = buildEACCES(dirPath);

	fs.mkdirSync = sinon.stub(fs, 'mkdirSync').throws(mkdirError);

	const err = t.throws(() => m.sync('license', dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, mkdirError.errno, err);
	t.is(err.code, mkdirError.code, err);
	t.is(err.path, mkdirError.path, err);
	t.true(fs.mkdirSync.called);

	fs.mkdirSync.restore();
});

test('rethrow ENOSPC errors in fallback mode', t => {
	// Only run test on node without native fs.copyFileSync
	if (fs.copyFileSync) {
		t.pass();
		return;
	}

	const noSpaceError = buildENOSPC();

	fs.writeFileSync(t.context.src, '');
	fs.writeSync = sinon.stub(fs, 'writeSync').throws(noSpaceError);

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, noSpaceError.errno, err);
	t.is(err.code, noSpaceError.code, err);
	t.true(fs.writeSync.called);

	fs.writeSync.restore();
});

test('rethrow ENOSPC errors in native mode', t => {
	// Only run test on node with native fs.copyFileSync
	if (!fs.copyFileSync) {
		t.pass();
		return;
	}

	const noSpaceError = buildENOSPC();

	fs.writeFileSync(t.context.src, '');
	fs.copyFileSync = sinon.stub(fs, 'copyFileSync').throws(noSpaceError);

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, noSpaceError.errno, err);
	t.is(err.code, noSpaceError.code, err);
	t.true(fs.copyFileSync.called, 1);

	fs.copyFileSync.restore();
});

test('rethrow fstat errors', t => {
	// Only run test on node without native fs.copyFileSync
	if (fs.copyFileSync) {
		t.pass();
		return;
	}

	const fstatError = buildEBADF();

	fs.writeFileSync(t.context.src, '');
	fs.fstatSync = sinon.stub(fs, 'fstatSync').throws(fstatError);

	const err = t.throws(() => m.sync(t.context.src, t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, fstatError.errno, err);
	t.is(err.code, fstatError.code, err);
	t.true(fs.fstatSync.called);

	fs.fstatSync.restore();
});

test('rethrow stat errors', t => {
	// Only run test on node with native fs.copyFileSync
	if (!fs.copyFileSync) {
		t.pass();
		return;
	}

	const statError = buildEBADF();

	fs.writeFileSync(t.context.src, '');

	fs.statSync = sinon.stub(fs, 'statSync').throws(statError);

	const err = t.throws(() => m.sync(t.context.src, t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, statError.errno, err);
	t.is(err.code, statError.code, err);
	t.true(fs.statSync.called);

	fs.statSync.restore();
});

test('rethrow utimes errors in fallback mode', t => {
	// Only run test on node without native fs.copyFileSync
	if (fs.copyFileSync) {
		t.pass();
		return;
	}

	const futimesError = buildEBADF();

	fs.futimesSync = sinon.stub(fs, 'futimesSync').throws(futimesError);

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, futimesError.errno, err);
	t.is(err.code, futimesError.code, err);
	t.true(fs.futimesSync.called);

	fs.futimesSync.restore();
});

test('rethrow utimes errors in native mode', t => {
	// Only run test on node with native fs.copyFileSync
	if (!fs.copyFileSync) {
		t.pass();
		return;
	}

	const futimesError = buildEBADF();

	fs.utimesSync = sinon.stub(fs, 'utimesSync').throws(futimesError);

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, futimesError.errno, err);
	t.is(err.code, futimesError.code, err);
	t.true(fs.utimesSync.called);

	fs.utimesSync.restore();
});

test('rethrow EACCES errors of dest in fallback mode', t => {
	// Only run test on node without native fs.copyFileSync
	if (fs.copyFileSync) {
		t.pass();
		return;
	}

	const openError = buildEACCES(t.context.dest);

	fs.openSync = sinon.stub(fs, 'openSync').throws(openError);

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, openError.errno, err);
	t.is(err.code, openError.code, err);
	t.is(err.path, openError.path, err);
	t.true(fs.openSync.called);

	fs.openSync.restore();
});

test('rethrow chmod errors', t => {
	const version = process.version.substring(1).split('.').map(Number);

	// Only run test on node without native chmod()
	if (version[0] > 8 || (version[0] === 8 && version[1] >= 7)) {
		t.pass();
		return;
	}

	const chmodError = buildEPERM(t.context.dest, 'chmod');

	fs.chmodSync = sinon.stub(fs, 'chmodSync').throws(chmodError);

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, chmodError.errno, err);
	t.is(err.code, chmodError.code, err);
	t.true(fs.chmodSync.called);

	fs.chmodSync.restore();
});

test('rethrow chown errors', t => {
	const chownError = buildEPERM(t.context.dest, 'chown');

	fs.chownSync = sinon.stub(fs, 'chownSync').throws(chownError);

	const err = t.throws(() => m.sync('license', t.context.dest));
	t.is(err.name, 'CpFileError', err);
	t.is(err.errno, chownError.errno, err);
	t.is(err.code, chownError.code, err);
	t.true(fs.chownSync.called);

	fs.chownSync.restore();
});
