export interface Options {
	/**
	 * Overwrite existing file.
	 *
	 * @default true
	 */
	readonly overwrite?: boolean;
}

export interface ProgressData {
	/**
	 * Absolute path to source.
	 */
	src: string;

	/**
	 * Absolute path to destination.
	 */
	dest: string;

	/**
	 * File size in bytes.
	 */
	size: number;

	/**
	 * Copied size in bytes.
	 */
	written: number;

	/**
	 * Copied percentage, a value between `0` and `1`.
	 */
	percent: number;
}

export interface ProgressEmitter {
	/**
	 * For empty files, the `progress` event is emitted only once.
	 */
	on(event: 'progress', handler: (data: ProgressData) => void): Promise<void>;
}

/**
 * Copy a file.
 *
 * @param source File you want to copy.
 * @param destination Where you want the file copied.
 * @returns A `Promise`.
 */
export default function cpFile(
	source: string,
	destination: string,
	options?: Options
): Promise<void> & ProgressEmitter;

/**
 * Copy a file synchronously.
 *
 * @param source File you want to copy.
 * @param destination Where you want the file copied.
 */
export function sync(
	source: string,
	destination: string,
	options?: Options
): void;
