import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import del from 'del';
import test from 'ava';
import {v4 as uuidv4} from 'uuid';
import sinon from 'sinon';
import assertDateEqual from './helpers/_assert';
import {buildEACCES, buildENOSPC, buildEBADF} from './helpers/_fs-errors';
import cpFile from '..';

const THREE_HUNDRED_KILO = (100 * 3 * 1024) + 1;

test.before(() => {
	process.chdir(path.dirname(__dirname));
});

test.beforeEach(t => {
	t.context.source = uuidv4();
	t.context.destination = uuidv4();
	t.context.creates = [t.context.source, t.context.destination];
});

test.afterEach.always(t => {
	for (const path_ of t.context.creates) {
		del.sync(path_);
	}
});

test('throw an Error on missing `source`', t => {
	t.throws(() => {
		cpFile.sync();
	}, /`source`/);
});

test('throw an Error on missing `destination`', t => {
	t.throws(() => {
		cpFile.sync('TARGET');
	}, /`destination`/);
});

test('copy a file', t => {
	cpFile.sync('license', t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('copy an empty file', t => {
	fs.writeFileSync(t.context.source, '');
	cpFile.sync(t.context.source, t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), '');
});

test('copy big files', t => {
	const buffer = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buffer);
	cpFile.sync(t.context.source, t.context.destination);
	t.true(buffer.equals(fs.readFileSync(t.context.destination)));
});

test('do not alter overwrite option', t => {
	const options = {};
	cpFile.sync('license', t.context.destination, options);
	t.false('overwrite' in options);
});

test('overwrite when enabled', t => {
	fs.writeFileSync(t.context.destination, '');
	cpFile.sync('license', t.context.destination, {overwrite: true});
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('overwrite when options are undefined', t => {
	fs.writeFileSync(t.context.destination, '');
	cpFile.sync('license', t.context.destination);
	t.is(fs.readFileSync(t.context.destination, 'utf8'), fs.readFileSync('license', 'utf8'));
});

test('do not overwrite when disabled', t => {
	fs.writeFileSync(t.context.destination, '');
	cpFile.sync('license', t.context.destination, {overwrite: false});
	t.is(fs.readFileSync(t.context.destination, 'utf8'), '');
});

if (process.platform !== 'win32') {
	test('create directories with specified mode', t => {
		const directory = t.context.destination;
		const destination = `${directory}/${uuidv4()}`;
		const directoryMode = 0o700;
		cpFile.sync('license', destination, {directoryMode});
		const stat = fs.statSync(directory);
		t.is(stat.mode & directoryMode, directoryMode);
	});
}

test('do not create `destination` on unreadable `source`', t => {
	t.throws(
		() => {
			cpFile.sync('node_modules', t.context.destination);
		},
		{
			name: 'CpFileError',
			code: 'EISDIR'
		}
	);

	t.throws(() => {
		fs.statSync(t.context.destination);
	}, /ENOENT/);
});

test('do not create `destination` directory on unreadable `source`', t => {
	t.throws(
		() => {
			cpFile.sync('node_modules', `subdir/${uuidv4()}`);
		},
		{
			name: 'CpFileError',
			code: 'EISDIR'
		}
	);

	t.throws(() => {
		fs.statSync('subdir');
	}, /ENOENT/);
});

test('preserve timestamps', t => {
	cpFile.sync('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const temporaryStats = fs.lstatSync(t.context.destination);
	assertDateEqual(t, licenseStats.atime, temporaryStats.atime);
	assertDateEqual(t, licenseStats.mtime, temporaryStats.mtime);
});

test('preserve mode', t => {
	cpFile.sync('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const temporaryStats = fs.lstatSync(t.context.destination);
	t.is(licenseStats.mode, temporaryStats.mode);
});

test('throw an Error if `source` does not exists', t => {
	const error = t.throws(() => {
		cpFile.sync('NO_ENTRY', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, 'ENOENT', error.message);
	t.regex(error.message, /`NO_ENTRY`/, error.message);
	t.regex(error.stack, /`NO_ENTRY`/, error.message);
});

test('rethrow mkdir EACCES errors', t => {
	const directoryPath = `/root/NO_ACCESS_${uuidv4()}`;
	const destination = path.join(directoryPath, uuidv4());
	const mkdirError = buildEACCES(directoryPath);

	fs.mkdirSync = sinon.stub(fs, 'mkdirSync').throws(mkdirError);

	const error = t.throws(() => {
		cpFile.sync('license', destination);
	});
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.errno, mkdirError.errno, error.message);
	t.is(error.code, mkdirError.code, error.message);
	t.is(error.path, mkdirError.path, error.message);
	t.true(fs.mkdirSync.called);

	fs.mkdirSync.restore();
});

test('rethrow ENOSPC errors', t => {
	const noSpaceError = buildENOSPC();

	fs.writeFileSync(t.context.source, '');
	fs.copyFileSync = sinon.stub(fs, 'copyFileSync').throws(noSpaceError);

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.errno, noSpaceError.errno, error.message);
	t.is(error.code, noSpaceError.code, error.message);
	t.true(fs.copyFileSync.called);

	fs.copyFileSync.restore();
});

test('rethrow stat errors', t => {
	const statError = buildEBADF();

	fs.writeFileSync(t.context.source, '');

	fs.statSync = sinon.stub(fs, 'statSync').throws(statError);

	const error = t.throws(() => {
		cpFile.sync(t.context.source, t.context.destination);
	});
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.errno, statError.errno, error.message);
	t.is(error.code, statError.code, error.message);
	t.true(fs.statSync.called);

	fs.statSync.restore();
});

test('rethrow utimes errors', t => {
	const futimesError = buildEBADF();

	fs.utimesSync = sinon.stub(fs, 'utimesSync').throws(futimesError);

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.errno, futimesError.errno, error.message);
	t.is(error.code, futimesError.code, error.message);
	t.true(fs.utimesSync.called);

	fs.utimesSync.restore();
});

test('test cwd option', t => {
	const error = t.throws(() => {
		cpFile.sync('sync.js', t.context.destination);
	});

	t.is(error.name, 'CpFileError');
	t.is(error.code, 'ENOENT');

	t.notThrows(() => {
		cpFile.sync('sync.js', t.context.destination, {cwd: 'test'});
	});
});
