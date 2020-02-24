'use strict';
const EventEmitter = require('events');

const writtenBytes = new WeakMap();

class ProgressEmitter extends EventEmitter {
	constructor(sourcePath, destinationPath) {
		super();
		this._sourcePath = sourcePath;
		this._destinationPath = destinationPath;
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
