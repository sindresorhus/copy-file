'use strict';
const childProcess = require('child_process');

/**
 * Returns a Windows drive letter.
 * @param {string} path
 * @returns {string | undefined}
 */
function driveLetter(path) {
	return path.match(/^([A-Z]:)[\\/]/)[1];
}

/**
 * Return something with a filesystem name for a path.
 * Only works on an English installation for obvious reasons.
 * @param {string} path
 * @returns {string | undefined}
 */
function getFsNameWin32(path) {
	// Get the drive. If it has a drive letter in the front we use it, otherwise assume to be the same as cwd.
	const drive = driveLetter(path) || driveLetter(process.cwd);
	try {
		return childProcess.execSync(`fsutil fsinfo volumeInfo ${drive}`, {encoding: 'ascii'})
			.split('\r\n')
			.filter(s => s.startsWith('File System Name'))
			.join('\r\n');
	} catch (_) {
		return undefined;
	}
}

/**
 * Return something with a filesystem name for a path.
 * @param {string} path
 * @returns {string | undefined}
 * @see {@link https://unix.stackexchange.com/a/21807|How can I determine the fs type of my current working directory?}
 */
function getFsNamePosix(path) {
	try {
		return childProcess.execSync(`mount | grep "^$(df -Pk '${path.replace(/'/g, '\'\\\'\'')}' | head -n 2 | tail -n 1 | cut -f 1 -d ' ') "`,
			{encoding: 'utf8'});
	} catch (_) {
		return undefined;
	}
}

export default process.platform === 'win32' ? getFsNameWin32 : getFsNamePosix;
