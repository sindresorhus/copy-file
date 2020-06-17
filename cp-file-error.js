/// <reference path="index.d.ts" />
'use strict';
const NestedError = require('nested-error-stacks');

class CpFileError extends NestedError {
	/**
	 * @param {string} message
	 * @param {Error} [nested]
	 */
	constructor(message, nested) {
		super(message, nested);
		Object.assign(this, nested);
		this.name = 'CpFileError';
	}
}

module.exports = CpFileError;
