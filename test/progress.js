import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import test from 'ava';
import uuid from 'uuid';
import m from '../';

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

test('report progress', async t => {
	const buf = crypto.pseudoRandomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.src, buf);

	let calls = 0;
	await m(t.context.src, t.context.dest).on('progress', progress => {
		calls++;
		t.is(typeof progress.src, 'string');
		t.is(typeof progress.dest, 'string');
		t.is(typeof progress.size, 'number');
		t.is(typeof progress.written, 'number');
		t.is(typeof progress.percent, 'number');
		t.is(progress.size, THREE_HUNDRED_KILO);
	});

	t.true(calls > 0);
});

test('report progress of 100 on end', async t => {
	const buf = crypto.pseudoRandomBytes(THREE_HUNDRED_KILO);
	fs.writeFileSync(t.context.src, buf);

	let lastEvent;
	await m(t.context.src, t.context.dest).on('progress', progress => {
		lastEvent = progress;
	});

	t.is(lastEvent.percent, 1);
	t.is(lastEvent.written, THREE_HUNDRED_KILO);
});

test('report progress for empty files once', async t => {
	fs.writeFileSync(t.context.src, '');

	let calls = 0;
	await m(t.context.src, t.context.dest).on('progress', progress => {
		calls++;
		t.is(progress.size, 0);
		t.is(progress.written, 0);
		t.is(progress.percent, 1);
	});

	t.is(calls, 1);
});
