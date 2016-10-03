import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import pify from 'pify';
import rewire from 'rewire';
import rimraf from 'rimraf';
import test from 'ava';
import uuid from 'uuid';
import m from '../';
import {assertDateEqual} from './_assert';

const fsP = pify(fs);
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
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'EISDIR');
	t.throws(() => fs.statSync(t.context.dest), /ENOENT/);
});

test('do not create dest directory on unreadable src', async t => {
	const err = await t.throws(m('node_modules', 'subdir/tmp'));
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'EISDIR');
	t.throws(() => fs.statSync('subdir'), /ENOENT/);
});

test('preserve timestamps', async t => {
	await m('license', t.context.dest);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.dest);
	assertDateEqual(licenseStats.atime, tmpStats.atime);
	assertDateEqual(licenseStats.mtime, tmpStats.mtime);
});

test('throw an Error if `src` does not exists', async t => {
	const err = await t.throws(m('NO_ENTRY', t.context.dest));
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'ENOENT');
	t.regex(err.message, /`NO_ENTRY`/);
	t.regex(err.stack, /`NO_ENTRY`/);
});

test('rethrow mkdirp EACCES errors', async t => {
	const sut = rewire('../');
	const dirPath = '/root/NO_ACCESS';
	const mkdirError = new Error(`EACCES, permission denied '${dirPath}'`);

	let called = 0;

	mkdirError.errno = -13;
	mkdirError.code = 'EACCES';
	mkdirError.path = dirPath;

	sut.__set__('mkdirpP', () => {
		called++;
		return Promise.reject(mkdirError);
	});

	const err = await t.throws(sut('license', dirPath + '/tmp'));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.errno, mkdirError.errno);
	t.is(err.code, mkdirError.code);
	t.is(err.path, mkdirError.path);
});

test('ignore mkdirp EEXIST errors', async t => {
	const sut = rewire('../');
	const dirPath = '/root/NO_ACCESS';
	const mkdirError = new Error(`EEXIST, mkdir '${dirPath}'`);
	let called = 0;

	mkdirError.errno = -17;
	mkdirError.code = 'EEXIST';
	mkdirError.path = dirPath;

	sut.__set__('mkdirpP', () => {
		called++;
		return Promise.reject(mkdirError);
	});

	await sut('license', t.context.dest);
	t.is(called, 1);
	t.is(fs.readFileSync(t.context.dest, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('rethrow ENOSPC errors', async t => {
	const sut = rewire('../');
	const noSpaceError = new Error('ENOSPC, write');
	let called = false;

	noSpaceError.errno = -28;
	noSpaceError.code = 'ENOSPC';

	sut.__set__('fs', Object.assign({}, fs, {
		createWriteStream: (path, options) => {
			const stream = fs.createWriteStream(path, options);
			stream.on('pipe', () => {
				if (!called) {
					called = true;
					stream.emit('error', noSpaceError);
				}
			});
			return stream;
		}
	}));

	const err = await t.throws(sut('license', t.context.dest));
	t.true(called);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.errno, noSpaceError.errno);
	t.is(err.code, noSpaceError.code);
});

test('rethrow stat errors', async t => {
	const sut = rewire('../');
	let called = 0;

	sut.__set__('fsP', Object.assign({}, fsP, {
		lstat: () => {
			called++;

			// reject Error:
			return fsP.lstat(uuid.v4());
		}
	}));

	const err = await t.throws(sut('license', t.context.dest));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'ENOENT');
});

test('rethrow utimes errors', async t => {
	const sut = rewire('../');
	let called = 0;

	sut.__set__('fsP', Object.assign({}, fsP, {
		utimes: (path, atime, mtime) => {
			called++;

			// reject Error:
			return fsP.utimes(uuid.v4(), atime, mtime);
		}
	}));

	const err = await t.throws(sut('license', t.context.dest));
	t.is(called, 1);
	t.is(err.name, 'CpFileError', 'wrong Error name: ' + err.stack);
	t.is(err.code, 'ENOENT');
});
