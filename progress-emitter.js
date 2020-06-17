/// <reference path="index.d.ts" />
'use strict';
const { EventEmitter } = require('events');

/** @type {WeakMap<ProgressEmitter, number>} */
const writtenBytes = new WeakMap();

/** @type {import('.').ProgressEmitter} */
class ProgressEmitter extends EventEmitter {
	/**
	 * @param {string} sourcePath
	 * @param {string} destinationPath
	 */
	constructor(sourcePath, destinationPath) {
		super();
		/** @type {string} */
		this._sourcePath = sourcePath;
		/** @type {string} */
		this._destinationPath = destinationPath;
		/** @type {number} */
		this.size = Infinity;
	}

	get writtenBytes() {
		// @ts-ignore
		return writtenBytes.get(this);
	}

	set writtenBytes(value) {
		// @ts-ignore
		writtenBytes.set(this, value);
		this.emitProgress();
	}

	emitProgress() {
		const {size, writtenBytes} = this;

		this.emit('progress', {
			sourcePath: this._sourcePath,
			destinationPath: this._destinationPath,
			size,
			writtenBytes,
			// @ts-ignore
			percent: writtenBytes === size ? 1 : writtenBytes / size
		});
	}
}

module.exports = ProgressEmitter;
