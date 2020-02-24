'use strict';
const EventEmitter = require('events');

const written = new WeakMap();

class ProgressEmitter extends EventEmitter {
	constructor(source, destination) {
		super();
		this._source = source;
		this._destination = destination;
	}

	get written() {
		return written.get(this);
	}

	set written(value) {
		written.set(this, value);
		this.emitProgress();
	}

	emitProgress() {
		const {size, written} = this;

		this.emit('progress', {
			src: this._source,
			dest: this._destination,
			size,
			written,
			percent: written === size ? 1 : written / size
		});
	}
}

module.exports = ProgressEmitter;
