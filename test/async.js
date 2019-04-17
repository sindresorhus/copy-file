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
	t.context.source = uuid.v4();
	t.context.destination = uuid.v4();
	t.context.creates = [t.context.source, t.context.destination];
});

test.afterEach.always(t => {
	t.context.creates.forEach(path => del.sync(path));
});

test('reject an Error on missing `source`', async t => {
	await t.throwsAsync(cpFile(), /`source`/);
});

test('reject an Error on missing `destination`', async t => {
	await t.throwsAsync(cpFile('TARGET'), /`destination`/);
});

test('copy a file', async t => {
	await cpFile('license', t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('copy an empty file', async t => {
	fs.writeFileSync(t.context.source, '');
	await cpFile(t.context.source, t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), '');
});

test('copy big files', async t => {
	const buf = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buf);
	await cpFile(t.context.source, t.context.destination);
	t.true(buf.equals(fs.readFileSync(t.context.destination)));
});

test('do not alter overwrite option', async t => {
	const options = {};
	await cpFile('license', t.context.destination, options);
	t.false('overwrite' in options);
});

test('overwrite when enabled', async t => {
	fs.writeFileSync(t.context.destination, '');
	await cpFile('license', t.context.destination, {overwrite: true});
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('overwrite when options are undefined', async t => {
	fs.writeFileSync(t.context.destination, '');
	await cpFile('license', t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('do not overwrite when disabled', async t => {
	fs.writeFileSync(t.context.destination, '');
	await cpFile('license', t.context.destination, {overwrite: false});
	t.is(fs.readFileSync(t.context.destination, 'utf8'), '');
});

test('do not create `destination` on unreadable `source`', async t => {
	const error = await t.throwsAsync(() => cpFile('node_modules', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.code, 'EISDIR', error);
	t.throws(() => {
		fs.statSync(t.context.destination);
	}, /ENOENT/);
});

test('do not create `destination` directory on unreadable `source`', async t => {
	const error = await t.throwsAsync(() => cpFile('node_modules', 'subdir/' + uuid.v4()));
	t.is(error.name, 'CpFileError', error);
	t.is(error.code, 'EISDIR', error);
	t.throws(() => {
		fs.statSync('subdir');
	}, /ENOENT/);
});

test('preserve timestamps', async t => {
	await cpFile('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.destination);
	assertDateEqual(t, licenseStats.atime, tmpStats.atime);
	assertDateEqual(t, licenseStats.mtime, tmpStats.mtime);
});

test('preserve mode', async t => {
	await cpFile('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.destination);
	t.is(licenseStats.mode, tmpStats.mode);
});

test('preserve ownership', async t => {
	await cpFile('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.destination);
	t.is(licenseStats.gid, tmpStats.gid);
	t.is(licenseStats.uid, tmpStats.uid);
});

test('throw an Error if `source` does not exists', async t => {
	const error = await t.throwsAsync(cpFile('NO_ENTRY', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.code, 'ENOENT', error);
	t.regex(error.message, /`NO_ENTRY`/, error);
	t.regex(error.stack, /`NO_ENTRY`/, error);
});

test.serial('rethrow mkdir EACCES errors', async t => {
	const dirPath = '/root/NO_ACCESS_' + uuid.v4();
	const dest = dirPath + '/' + uuid.v4();
	const mkdirError = buildEACCES(dirPath);

	fs.mkdir = sinon.stub(fs, 'mkdir').throws(mkdirError);

	const error = await t.throwsAsync(cpFile('license', dest));
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, mkdirError.errno, error);
	t.is(error.code, mkdirError.code, error);
	t.is(error.path, mkdirError.path, error);
	t.true(fs.mkdir.called);

	fs.mkdir.restore();
});

test.serial('rethrow ENOSPC errors', async t => {
	const {createWriteStream} = fs;
	const noSpaceError = buildENOSPC();
	let called = false;

	fs.createWriteStream = (path, options) => {
		const stream = createWriteStream(path, options);
		if (path === t.context.destination) {
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
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, noSpaceError.errno, error);
	t.is(error.code, noSpaceError.code, error);
	t.true(called);
});

test.serial('rethrow stat errors', async t => {
	const fstatError = buildENOENT();

	fs.writeFileSync(t.context.source, '');
	fs.lstat = sinon.stub(fs, 'lstat').throws(fstatError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached(t.context.source, t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, fstatError.errno, error);
	t.is(error.code, fstatError.code, error);
	t.true(fs.lstat.called);

	fs.lstat.restore();
});

test.serial('rethrow utimes errors', async t => {
	const utimesError = buildENOENT();

	fs.utimes = sinon.stub(fs, 'utimes').throws(utimesError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.code, 'ENOENT', error);
	t.true(fs.utimes.called);

	fs.utimes.restore();
});

test.serial('rethrow chmod errors', async t => {
	const chmodError = buildEPERM(t.context.destination, 'chmod');

	fs.chmod = sinon.stub(fs, 'chmod').throws(chmodError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.code, chmodError.code, error);
	t.is(error.path, chmodError.path, error);
	t.true(fs.chmod.called);

	fs.chmod.restore();
});

test.serial('rethrow chown errors', async t => {
	const chownError = buildEPERM(t.context.destination, 'chown');

	fs.chown = sinon.stub(fs, 'chown').throws(chownError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.code, chownError.code, error);
	t.is(error.path, chownError.path, error);
	t.true(fs.chown.called);

	fs.chown.restore();
});

test.serial('rethrow read after open errors', async t => {
	const {createWriteStream, createReadStream} = fs;
	let calledWriteEnd = 0;
	let readStream;
	const readError = buildEIO();

	fs.createWriteStream = (...args) => {
		const stream = createWriteStream(...args);
		const {end} = stream;

		stream.on('pipe', () => {
			readStream.emit('error', readError);
		});

		stream.end = (...endArgs) => {
			calledWriteEnd++;
			return end.apply(stream, endArgs);
		};

		return stream;
	};

	fs.createReadStream = (...args) => {
		/* Fake stream */
		readStream = createReadStream(...args);
		readStream.pause();

		return readStream;
	};

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, readError.errno, error);
	t.is(error.code, readError.code, error);
	t.is(calledWriteEnd, 1);

	Object.assign(fs, {createWriteStream, createReadStream});
});
