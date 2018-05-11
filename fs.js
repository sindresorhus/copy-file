'use strict';
const fs = require('graceful-fs');
const makeDir = require('make-dir');
const pify = require('pify');
const CpFileError = require('./cp-file-error');

const fsP = pify(fs);

exports.closeSync = fs.closeSync.bind(fs);
exports.createWriteStream = fs.createWriteStream.bind(fs);

exports.createReadStream = (path, options) => new Promise((resolve, reject) => {
	const read = fs.createReadStream(path, options);

	read.once('error', err => {
		reject(new CpFileError(`Cannot read from \`${path}\`: ${err.message}`, err));
	});

	read.once('readable', () => {
		resolve(read);
	});

	read.once('end', () => {
		resolve(read);
	});
});

exports.stat = path => fsP.stat(path).catch(err => {
	throw new CpFileError(`Cannot stat path \`${path}\`: ${err.message}`, err);
});

exports.lstat = path => fsP.lstat(path).catch(err => {
	throw new CpFileError(`lstat \`${path}\` failed: ${err.message}`, err);
});

exports.utimes = (path, atime, mtime) => fsP.utimes(path, atime, mtime).catch(err => {
	throw new CpFileError(`utimes \`${path}\` failed: ${err.message}`, err);
});

exports.chmod = (path, mode) => fsP.chmod(path, mode).catch(err => {
	throw new CpFileError(`chmod \`${path}\` failed: ${err.message}`, err);
});

exports.chown = (path, uid, gid) => fsP.chown(path, uid, gid).catch(err => {
	throw new CpFileError(`chown \`${path}\` failed: ${err.message}`, err);
});

exports.openSync = (path, flags, mode) => {
	try {
		return fs.openSync(path, flags, mode);
	} catch (err) {
		if (flags.includes('w')) {
			throw new CpFileError(`Cannot write to \`${path}\`: ${err.message}`, err);
		}

		throw new CpFileError(`Cannot open \`${path}\`: ${err.message}`, err);
	}
};

// eslint-disable-next-line max-params
exports.readSync = (fd, buffer, offset, length, position, path) => {
	try {
		return fs.readSync(fd, buffer, offset, length, position);
	} catch (err) {
		throw new CpFileError(`Cannot read from \`${path}\`: ${err.message}`, err);
	}
};

// eslint-disable-next-line max-params
exports.writeSync = (fd, buffer, offset, length, position, path) => {
	try {
		return fs.writeSync(fd, buffer, offset, length, position);
	} catch (err) {
		throw new CpFileError(`Cannot write to \`${path}\`: ${err.message}`, err);
	}
};

exports.statSync = path => {
	try {
		return fs.statSync(path);
	} catch (err) {
		throw new CpFileError(`stat \`${path}\` failed: ${err.message}`, err);
	}
};

exports.fstatSync = (fd, path) => {
	try {
		return fs.fstatSync(fd);
	} catch (err) {
		throw new CpFileError(`fstat \`${path}\` failed: ${err.message}`, err);
	}
};

exports.futimesSync = (fd, atime, mtime, path) => {
	try {
		return fs.futimesSync(fd, atime, mtime, path);
	} catch (err) {
		throw new CpFileError(`futimes \`${path}\` failed: ${err.message}`, err);
	}
};

exports.utimesSync = (path, atime, mtime) => {
	try {
		return fs.utimesSync(path, atime, mtime);
	} catch (err) {
		throw new CpFileError(`utimes \`${path}\` failed: ${err.message}`, err);
	}
};

exports.chmodSync = (path, mode) => {
	try {
		return fs.chmodSync(path, mode);
	} catch (err) {
		throw new CpFileError(`chmod \`${path}\` failed: ${err.message}`, err);
	}
};

exports.chownSync = (path, uid, gid) => {
	try {
		return fs.chownSync(path, uid, gid);
	} catch (err) {
		throw new CpFileError(`chown \`${path}\` failed: ${err.message}`, err);
	}
};

exports.makeDir = path => makeDir(path, {fs}).catch(err => {
	throw new CpFileError(`Cannot create directory \`${path}\`: ${err.message}`, err);
});

exports.makeDirSync = path => {
	try {
		makeDir.sync(path, {fs});
	} catch (err) {
		throw new CpFileError(`Cannot create directory \`${path}\`: ${err.message}`, err);
	}
};

if (fs.copyFileSync) {
	exports.copyFileSync = (src, dest, flags) => {
		try {
			fs.copyFileSync(src, dest, flags);
		} catch (err) {
			throw new CpFileError(`Cannot copy from \`${src}\` to \`${dest}\`: ${err.message}`, err);
		}
	};
}
