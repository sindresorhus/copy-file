import crypto from 'crypto';
import path from 'path';
import fs from 'graceful-fs';
import del from 'del';
import test from 'ava';
import {v4 as uuidv4} from 'uuid';
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
	t.context.creates.forEach(path => del.sync(path));
});

test('report progress', async t => {
	const buffer = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buffer);

	const progressHandler = progress => {
		t.is(typeof progress.sourcePath, 'string');
		t.is(typeof progress.destinationPath, 'string');
		t.is(typeof progress.size, 'number');
		t.is(typeof progress.writtenBytes, 'number');
		t.is(typeof progress.percent, 'number');
		t.is(progress.size, THREE_HUNDRED_KILO);
	};

	let callCount = 0;

	await cpFile(t.context.source, t.context.destination).on('progress', progress => {
		callCount++;
		progressHandler(progress);
	});

	t.true(callCount > 0);

	let callCountOption = 0;

	await cpFile(t.context.source, t.context.destination, {
		onProgress: progress => {
			callCountOption++;
			progressHandler(progress);
		}
	});

	t.true(callCountOption > 0);
});

test('report progress of 100% on end', async t => {
	const buffer = crypto.randomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.source, buffer);

	let lastRecordEvent;

	await cpFile(t.context.source, t.context.destination).on('progress', progress => {
		lastRecordEvent = progress;
	});

	t.is(lastRecordEvent.percent, 1);
	t.is(lastRecordEvent.writtenBytes, THREE_HUNDRED_KILO);

	let lastRecordOption;

	await cpFile(t.context.source, t.context.destination, {
		onProgress: progress => {
			lastRecordOption = progress;
		}
	});

	t.is(lastRecordOption.percent, 1);
	t.is(lastRecordOption.writtenBytes, THREE_HUNDRED_KILO);
});

test('report progress for empty files once', async t => {
	fs.writeFileSync(t.context.source, '');

	const progressHandler = progress => {
		t.is(progress.size, 0);
		t.is(progress.writtenBytes, 0);
		t.is(progress.percent, 1);
	};

	let callCount = 0;

	await cpFile(t.context.source, t.context.destination).on('progress', progress => {
		callCount++;
		progressHandler(progress);
	});

	t.is(callCount, 1);

	let callCountOption = 0;

	await cpFile(t.context.source, t.context.destination, {
		onProgress: progress => {
			callCountOption++;
			progressHandler(progress);
		}
	});

	t.is(callCountOption, 1);
});
