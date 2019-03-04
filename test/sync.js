import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import del from 'del';
import test from 'ava';
import uuid from 'uuid';
import sinon from 'sinon';
import cpFile from '..';
import assertDateEqual from './helpers/assert';
import {buildEACCES, buildENOSPC, buildEBADF, buildEPERM} from './helpers/fs-errors';

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
	const buf = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buf);
	cpFile.sync(t.context.source, t.context.destination);
	t.true(buf.equals(fs.readFileSync(t.context.destination)));
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
			cpFile.sync('node_modules', 'subdir/' + uuid.v4());
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
	const tmpStats = fs.lstatSync(t.context.destination);
	assertDateEqual(t, licenseStats.atime, tmpStats.atime);
	assertDateEqual(t, licenseStats.mtime, tmpStats.mtime);
});

test('preserve mode', t => {
	cpFile.sync('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.destination);
	t.is(licenseStats.mode, tmpStats.mode);
});

test('preserve ownership', t => {
	cpFile.sync('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const tmpStats = fs.lstatSync(t.context.destination);
	t.is(licenseStats.gid, tmpStats.gid);
	t.is(licenseStats.uid, tmpStats.uid);
});

test('throw an Error if `source` does not exists', t => {
	const error = t.throws(() => cpFile.sync('NO_ENTRY', t.context.destination));
	t.is(error.name, 'CpFileError', error);
	t.is(error.code, 'ENOENT', error);
	t.regex(error.message, /`NO_ENTRY`/, error);
	t.regex(error.stack, /`NO_ENTRY`/, error);
});

test('rethrow mkdir EACCES errors', t => {
	const dirPath = '/root/NO_ACCESS_' + uuid.v4();
	const dest = dirPath + '/' + uuid.v4();
	const mkdirError = buildEACCES(dirPath);

	fs.mkdirSync = sinon.stub(fs, 'mkdirSync').throws(mkdirError);

	const error = t.throws(() => {
		cpFile.sync('license', dest);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, mkdirError.errno, error);
	t.is(error.code, mkdirError.code, error);
	t.is(error.path, mkdirError.path, error);
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

	fs.writeFileSync(t.context.source, '');
	fs.writeSync = sinon.stub(fs, 'writeSync').throws(noSpaceError);

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, noSpaceError.errno, error);
	t.is(error.code, noSpaceError.code, error);
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

	fs.writeFileSync(t.context.source, '');
	fs.copyFileSync = sinon.stub(fs, 'copyFileSync').throws(noSpaceError);

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, noSpaceError.errno, error);
	t.is(error.code, noSpaceError.code, error);
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

	fs.writeFileSync(t.context.source, '');
	fs.fstatSync = sinon.stub(fs, 'fstatSync').throws(fstatError);

	const error = t.throws(() => {
		cpFile.sync(t.context.source, t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, fstatError.errno, error);
	t.is(error.code, fstatError.code, error);
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

	fs.writeFileSync(t.context.source, '');

	fs.statSync = sinon.stub(fs, 'statSync').throws(statError);

	const error = t.throws(() => {
		cpFile.sync(t.context.source, t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, statError.errno, error);
	t.is(error.code, statError.code, error);
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

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, futimesError.errno, error);
	t.is(error.code, futimesError.code, error);
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

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, futimesError.errno, error);
	t.is(error.code, futimesError.code, error);
	t.true(fs.utimesSync.called);

	fs.utimesSync.restore();
});

test('rethrow EACCES errors of dest in fallback mode', t => {
	// Only run test on node without native fs.copyFileSync
	if (fs.copyFileSync) {
		t.pass();
		return;
	}

	const openError = buildEACCES(t.context.destination);

	fs.openSync = sinon.stub(fs, 'openSync').throws(openError);

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, openError.errno, error);
	t.is(error.code, openError.code, error);
	t.is(error.path, openError.path, error);
	t.true(fs.openSync.called);

	fs.openSync.restore();
});

test('rethrow chmod errors', t => {
	const chmodError = buildEPERM(t.context.destination, 'chmod');

	fs.chmodSync = sinon.stub(fs, 'chmodSync').throws(chmodError);

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, chmodError.errno, error);
	t.is(error.code, chmodError.code, error);
	t.true(fs.chmodSync.called);

	fs.chmodSync.restore();
});

test('rethrow chown errors', t => {
	const chownError = buildEPERM(t.context.destination, 'chown');

	fs.chownSync = sinon.stub(fs, 'chownSync').throws(chownError);

	const error = t.throws(() => {
		cpFile.sync('license', t.context.destination);
	});
	t.is(error.name, 'CpFileError', error);
	t.is(error.errno, chownError.errno, error);
	t.is(error.code, chownError.code, error);
	t.true(fs.chownSync.called);

	fs.chownSync.restore();
});
