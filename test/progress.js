import process from 'node:process';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {deleteSync} from 'del';
import test from 'ava';
import {copyFile} from '../index.js';

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

test('report progress', async t => {
	const buffer = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buffer);

	let callCount = 0;

	await copyFile(t.context.source, t.context.destination, {
		onProgress(progress) {
			callCount++;
			t.is(typeof progress.sourcePath, 'string');
			t.is(typeof progress.destinationPath, 'string');
			t.is(typeof progress.size, 'number');
			t.is(typeof progress.writtenBytes, 'number');
			t.is(typeof progress.percent, 'number');
			t.is(progress.size, THREE_HUNDRED_KILO);
		},
	});

	t.true(callCount > 0);
});

test('report progress of 100% on end', async t => {
	const buffer = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buffer);

	let lastRecord;

	await copyFile(t.context.source, t.context.destination, {
		onProgress(progress) {
			lastRecord = progress;
		},
	});

	t.is(lastRecord.percent, 1);
	t.is(lastRecord.writtenBytes, THREE_HUNDRED_KILO);
});

test('report progress for empty files once', async t => {
	fs.writeFileSync(t.context.source, '');

	let callCount = 0;

	await copyFile(t.context.source, t.context.destination, {
		onProgress(progress) {
			callCount++;
			t.is(progress.size, 0);
			t.is(progress.writtenBytes, 0);
			t.is(progress.percent, 1);
		},
	});

	t.is(callCount, 1);
});
