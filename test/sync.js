import process from 'node:process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {deleteSync} from 'del';
import test from 'ava';
import sinon from 'sinon';
import {copyFileSync} from '../index.js';
import assertDateEqual from './helpers/_assert.js';
import {buildEACCES, buildENOSPC, buildEBADF} from './helpers/_fs-errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const THREE_HUNDRED_KILO = (100 * 3 * 1024) + 1;

test.before(() => {
	process.chdir(path.dirname(__dirname));
	deleteSync('temp'); // In case last test run failed.
	fs.mkdirSync('temp');
});

test.after(() => {
	deleteSync('temp');
});

test.beforeEach(t => {
	t.context.source = path.join('temp', crypto.randomUUID());
	t.context.destination = path.join('temp', crypto.randomUUID());
});

test('throw an Error on missing `source`', t => {
	t.throws(() => {
		copyFileSync();
	}, {
		message: /`source`/,
	});
});

test('throw an Error on missing `destination`', t => {
	t.throws(() => {
		copyFileSync('TARGET');
	}, {
		message: /`destination`/,
	});
});

test('copy a file', t => {
	copyFileSync('license', t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('copy an empty file', t => {
	fs.writeFileSync(t.context.source, '');
	copyFileSync(t.context.source, t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), '');
});

test('copy big files', t => {
	const buffer = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buffer);
	copyFileSync(t.context.source, t.context.destination);
	t.true(buffer.equals(fs.readFileSync(t.context.destination)));
});

test('do not alter overwrite option', t => {
	const options = {};
	copyFileSync('license', t.context.destination, options);
	t.false('overwrite' in options);
});

test('overwrite when enabled', t => {
	fs.writeFileSync(t.context.destination, '');
	copyFileSync('license', t.context.destination, {overwrite: true});
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('overwrite when options are undefined', t => {
	fs.writeFileSync(t.context.destination, '');
	copyFileSync('license', t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('do not overwrite when disabled', t => {
	fs.writeFileSync(t.context.destination, '');
	copyFileSync('license', t.context.destination, {overwrite: false});
	t.is(fs.readFileSync(t.context.destination, 'utf8'), '');
});

if (process.platform !== 'win32') {
	test('create directories with specified mode', t => {
		const directory = t.context.destination;
		const destination = `${directory}/${crypto.randomUUID()}`;
		const directoryMode = 0o700;
		copyFileSync('license', destination, {directoryMode});
		const stat = fs.statSync(directory);
		t.is(stat.mode & directoryMode, directoryMode); // eslint-disable-line no-bitwise
	});
}

test('do not create `destination` on unreadable `source`', t => {
	t.throws(
		() => {
			copyFileSync('node_modules', t.context.destination);
		},
		{
			name: 'CopyFileError',
			code: 'EISDIR',
		},
	);

	t.throws(() => {
		fs.statSync(t.context.destination);
	}, {
		message: /ENOENT/,
	});
});

test('do not create `destination` directory on unreadable `source`', t => {
	t.throws(
		() => {
			copyFileSync('node_modules', `subdir/${crypto.randomUUID()}`);
		},
		{
			name: 'CopyFileError',
			code: 'EISDIR',
		},
	);

	t.throws(() => {
		fs.statSync('subdir');
	}, {
		message: /ENOENT/,
	});
});

test('preserve timestamps', t => {
	copyFileSync('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const temporaryStats = fs.lstatSync(t.context.destination);
	assertDateEqual(t, licenseStats.atime, temporaryStats.atime);
	assertDateEqual(t, licenseStats.mtime, temporaryStats.mtime);
});

test('preserve mode', t => {
	copyFileSync('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const temporaryStats = fs.lstatSync(t.context.destination);
	t.is(licenseStats.mode, temporaryStats.mode);
});

test('throw an Error if `source` does not exists', t => {
	const error = t.throws(() => {
		copyFileSync('NO_ENTRY', t.context.destination);
	});
	t.is(error.name, 'CopyFileError', error.message);
	t.is(error.code, 'ENOENT', error.message);
	t.regex(error.message, /`NO_ENTRY`/, error.message);
	t.regex(error.stack, /`NO_ENTRY`/, error.message);
});

test.failing('rethrow mkdir EACCES errors', t => {
	const directoryPath = `/root/NO_ACCESS_${crypto.randomUUID()}`;
	const destination = path.join(directoryPath, crypto.randomUUID());
	const mkdirError = buildEACCES(directoryPath);

	fs.mkdirSync = sinon.stub(fs, 'mkdirSync').throws(mkdirError);

	const error = t.throws(() => {
		copyFileSync('license', destination);
	});
	t.is(error.name, 'CopyFileError', error.message);
	t.is(error.errno, mkdirError.errno, error.message);
	t.is(error.code, mkdirError.code, error.message);
	t.is(error.path, mkdirError.path, error.message);
	t.true(fs.mkdirSync.called);

	fs.mkdirSync.restore();
});

test.failing('rethrow ENOSPC errors', t => {
	const noSpaceError = buildENOSPC();

	fs.writeFileSync(t.context.source, '');
	fs.copyFileSync = sinon.stub(fs, 'copyFileSync').throws(noSpaceError);

	const error = t.throws(() => {
		copyFileSync('license', t.context.destination);
	});
	t.is(error.name, 'CopyFileError', error.message);
	t.is(error.errno, noSpaceError.errno, error.message);
	t.is(error.code, noSpaceError.code, error.message);
	t.true(fs.copyFileSync.called);

	fs.copyFileSync.restore();
});

test.failing('rethrow stat errors', t => {
	const statError = buildEBADF();

	fs.writeFileSync(t.context.source, '');

	fs.statSync = sinon.stub(fs, 'statSync').throws(statError);

	const error = t.throws(() => {
		copyFileSync(t.context.source, t.context.destination);
	});
	t.is(error.name, 'CopyFileError', error.message);
	t.is(error.errno, statError.errno, error.message);
	t.is(error.code, statError.code, error.message);
	t.true(fs.statSync.called);

	fs.statSync.restore();
});

test.failing('rethrow utimes errors', t => {
	const futimesError = buildEBADF();

	fs.utimesSync = sinon.stub(fs, 'utimesSync').throws(futimesError);

	const error = t.throws(() => {
		copyFileSync('license', t.context.destination);
	});
	t.is(error.name, 'CopyFileError', error.message);
	t.is(error.errno, futimesError.errno, error.message);
	t.is(error.code, futimesError.code, error.message);
	t.true(fs.utimesSync.called);

	fs.utimesSync.restore();
});

test('cwd option', t => {
	const error = t.throws(() => {
		copyFileSync('sync.js', t.context.destination);
	});

	t.is(error.name, 'CopyFileError');
	t.is(error.code, 'ENOENT');

	t.notThrows(() => {
		copyFileSync('sync.js', t.context.destination, {cwd: 'test'});
	});
});
