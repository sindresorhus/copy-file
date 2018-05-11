'use strict';
const EventEmitter = require('events');

const written = new WeakMap();

class ProgressEmitter extends EventEmitter {
	constructor(src, dest) {
		super();
		this.src = src;
		this.dest = dest;
	}

	set written(value) {
		written.set(this, value);
		this.emitProgress();
	}

	get written() {
		return written.get(this);
	}

	emitProgress() {
		const {size, written} = this;
		this.emit('progress', {
			src: this.src,
			dest: this.dest,
			size,
			written,
			percent: written === size ? 1 : written / size
		});
	}
}

module.exports = ProgressEmitter;
