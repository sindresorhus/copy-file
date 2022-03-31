import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import importFresh from 'import-fresh';
import clearModule from 'clear-module';
import del from 'del';
import test from 'ava';
import {v4 as uuidv4} from 'uuid';
import sinon from 'sinon';
import assertDateEqual from './helpers/_assert';
import {buildEACCES, buildEIO, buildENOSPC, buildENOENT, buildEPERM, buildERRSTREAMWRITEAFTEREND} from './helpers/_fs-errors';
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
	const buffer = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buffer);
	await cpFile(t.context.source, t.context.destination);
	t.true(buffer.equals(fs.readFileSync(t.context.destination)));
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
	const error = await t.throwsAsync(cpFile('license', t.context.destination, {overwrite: false}));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, 'EEXIST', error.message);
});

if (process.platform !== 'win32') {
	test('create directories with specified mode', async t => {
		const directory = t.context.destination;
		const destination = `${directory}/${uuidv4()}`;
		const directoryMode = 0o700;
		await cpFile('license', destination, {directoryMode});
		const stat = fs.statSync(directory);
		t.is(stat.mode & directoryMode, directoryMode);
	});
}

test('do not create `destination` on unreadable `source`', async t => {
	const error = await t.throwsAsync(cpFile('node_modules', t.context.destination));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, 'EISDIR', error.message);
	t.throws(() => {
		fs.statSync(t.context.destination);
	}, /ENOENT/);
});

test('do not create `destination` directory on unreadable `source`', async t => {
	const error = await t.throwsAsync(cpFile('node_modules', path.join('subdir', uuidv4())));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, 'EISDIR', error.message);
	t.throws(() => {
		fs.statSync('subdir');
	}, /ENOENT/);
});

test('preserve timestamps', async t => {
	await cpFile('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const temporaryStats = fs.lstatSync(t.context.destination);
	assertDateEqual(t, licenseStats.atime, temporaryStats.atime);
	assertDateEqual(t, licenseStats.mtime, temporaryStats.mtime);
});

test('preserve mode', async t => {
	await cpFile('license', t.context.destination);
	const licenseStats = fs.lstatSync('license');
	const temporaryStats = fs.lstatSync(t.context.destination);
	t.is(licenseStats.mode, temporaryStats.mode);
});

test('throw an Error if `source` does not exists', async t => {
	const error = await t.throwsAsync(cpFile('NO_ENTRY', t.context.destination));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, 'ENOENT', error.message);
	t.regex(error.message, /`NO_ENTRY`/, error.message);
	t.regex(error.stack, /`NO_ENTRY`/, error.message);
});

test.serial('rethrow mkdir EACCES errors', async t => {
	const directoryPath = `/root/NO_ACCESS_${uuidv4()}`;
	const destination = path.join(directoryPath, uuidv4());
	const mkdirError = buildEACCES(directoryPath);

	fs.stat = sinon.stub(fs, 'stat').throws(mkdirError);
	fs.mkdir = sinon.stub(fs, 'mkdir').throws(mkdirError);

	const error = await t.throwsAsync(cpFile('license', destination));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.errno, mkdirError.errno, error.message);
	t.is(error.code, mkdirError.code, error.message);
	t.is(error.path, mkdirError.path, error.message);
	t.true(fs.mkdir.called || fs.stat.called);

	fs.mkdir.restore();
	fs.stat.restore();
});

test.serial('rethrow ENOSPC errors', async t => {
	const {createWriteStream} = fs;
	const noSpaceError = buildENOSPC();
	let isCalled = false;

	fs.createWriteStream = (path, options) => {
		const stream = createWriteStream(path, options);
		if (path === t.context.destination) {
			stream.on('pipe', () => {
				if (!isCalled) {
					isCalled = true;
					stream.emit('error', noSpaceError);
				}
			});
		}

		return stream;
	};

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.errno, noSpaceError.errno, error.message);
	t.is(error.code, noSpaceError.code, error.message);
	t.true(isCalled);

	fs.createWriteStream = createWriteStream;
});

test.serial('rethrow stat errors', async t => {
	const fstatError = buildENOENT();

	fs.writeFileSync(t.context.source, '');
	fs.lstat = sinon.stub(fs, 'lstat').throws(fstatError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached(t.context.source, t.context.destination));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.errno, fstatError.errno, error.message);
	t.is(error.code, fstatError.code, error.message);
	t.true(fs.lstat.called);

	fs.lstat.restore();
});

test.serial('rethrow utimes errors', async t => {
	const utimesError = buildENOENT();

	fs.utimes = sinon.stub(fs, 'utimes').throws(utimesError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, 'ENOENT', error.message);
	t.true(fs.utimes.called);

	fs.utimes.restore();
});

test.serial('rethrow chmod errors', async t => {
	const chmodError = buildEPERM(t.context.destination, 'chmod');

	fs.chmod = sinon.stub(fs, 'chmod').throws(chmodError);

	clearModule('../fs');
	const uncached = importFresh('..');
	const error = await t.throwsAsync(uncached('license', t.context.destination));
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, chmodError.code, error.message);
	t.is(error.path, chmodError.path, error.message);
	t.true(fs.chmod.called);

	fs.chmod.restore();
});

test.serial('rethrow read after open errors', async t => {
	const {createWriteStream, createReadStream} = fs;
	let calledWriteEnd = 0;
	let readStream;
	const readError = process.release.lts === 'Erbium' || parseInt(process.versions.node.slice(0, 2), 10) > 12 ? buildERRSTREAMWRITEAFTEREND() : buildEIO();

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
	t.is(error.name, 'CpFileError', error.message);
	t.is(error.code, readError.code, error.message);
	t.is(error.errno, readError.errno, error.message);
	t.is(calledWriteEnd, 1);

	Object.assign(fs, {createWriteStream, createReadStream});
});

test('cwd option', async t => {
	const error = await t.throwsAsync(cpFile('sync.js', t.context.destination));

	t.is(error.name, 'CpFileError');
	t.is(error.code, 'ENOENT');

	await t.notThrowsAsync(cpFile('sync.js', t.context.destination, {cwd: 'test'}));
});
