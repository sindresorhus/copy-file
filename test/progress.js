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

test('progress emits ≤101 times and finishes at 100%', async t => {
	const size = 10 * 1024 * 1024; // 10 MiB
	const source = path.join('temp', `cap-${crypto.randomUUID()}.bin`);
	const destination = path.join('temp', `cap-out-${crypto.randomUUID()}.bin`);
	fs.mkdirSync('temp', {recursive: true});
	fs.writeFileSync(source, crypto.randomBytes(size));

	let callCount = 0;
	let lastRecord;
	await copyFile(source, destination, {
		onProgress(progress) {
			callCount++;
			lastRecord = progress;
		},
	});

	t.true(callCount <= 101);
	t.is(lastRecord.percent, 1);
	t.is(lastRecord.writtenBytes, size);
	t.true(fs.existsSync(destination));
});

test('progress emits at least once for tiny/empty files', async t => {
	for (const bytes of [0, 1, 42]) {
		const source = path.join('temp', `tiny-${bytes}-${crypto.randomUUID()}`);
		const destination = path.join('temp', `tiny-out-${bytes}-${crypto.randomUUID()}`);
		fs.writeFileSync(source, Buffer.alloc(bytes));

		let callCount = 0;
		let lastRecord;
		await copyFile(source, destination, {
			onProgress(progress) {
				callCount++;
				lastRecord = progress;
			}
		});

		t.true(callCount >= 1);
		t.is(lastRecord.percent, 1);
		t.is(lastRecord.writtenBytes, bytes);
	}
});
