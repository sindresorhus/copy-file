'use strict';
const EventEmitter = require('events');

/** @type {WeakMap<ProgressEmitter, number>} */
const writtenBytes = new WeakMap();

class ProgressEmitter extends EventEmitter {
	constructor(sourcePath, destinationPath) {
		super();
		/** @type {string} */
		this._sourcePath = sourcePath;
		/** @type {string} */
		this._destinationPath = destinationPath;
		/** @type {number | undefined} */
		this.size = undefined;
	}

	get writtenBytes() {
		return writtenBytes.get(this);
	}

	set writtenBytes(value) {
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
			percent: writtenBytes === size ? 1 : writtenBytes / size
		});
	}
}

module.exports = ProgressEmitter;
