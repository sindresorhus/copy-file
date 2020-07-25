/**
Tests equality of Date objects, w/o considering milliseconds.
@see {@link https://github.com/joyent/node/issues/7000|File timestamp resolution is inconsistent with fs.stat / fs.utimes}
 *
@param {Object} t - AVA's t
@param {*} actual - the actual value
@param {*} expected - the expected value
@param {*} message - error message
 */
export default function assertDateEqual(t, actual, expected, message) {
	actual = new Date(actual);
	expected = new Date(expected);

	actual.setMilliseconds(0);
	expected.setMilliseconds(0);

	t.is(actual.getTime(), expected.getTime(), message);
}
