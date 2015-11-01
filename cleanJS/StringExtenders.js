/*
 * FUNCTIONS TO GIVE STRING MORE CAPABILITIES
 */

/**
 * Find the last integer in a string
 * @returns {Number} NaN if no number found
 */
String.prototype.lastInteger = function lastInteger() {
    const DecimalRunsRegEx = /[0-9]+/g;
    var decimalRuns = this.match(DecimalRunsRegEx);
    if (decimalRuns)
        return parseInt(decimalRuns[decimalRuns.length - 1]);
    return NaN;
};

/**
 * Removes whitespace from the beginning and end of the string
 * @returns {string} the string with no leading/trailing whitespace
 */
String.prototype.trim = function trim() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
};

/**
 * runs through the string and escapes (adds a \) to the any of the char's that exist in _chars_
 * @param chars - a string, where you want every character in the string to be escaped
 * @returns {string} - a string with chars escaped
 */
String.prototype.escapeCharacters = function (chars) {
    var foundChar = false;
    for (var i = 0; i < chars.length; ++i) {
        if (this.indexOf(chars.charAt(i)) !== -1) {
            foundChar = true;
            break;
        }
    }
    if (!foundChar)
        return this;
    var result = "";
    for (var i = 0; i < this.length; ++i) {
        if (chars.indexOf(this.charAt(i)) !== -1)
            result += "\\";
        result += this.charAt(i);
    }
    return result;
};

/**
 * A wrapper for escapeCharacters that escapes the following chars
 * * ^
 * * [ AND ]
 * * { AND }
 * * ( AND )
 * * \
 * * .
 * * $
 * * *
 * * +
 * * ?
 * * |
 * @returns {string} escapeCharacters("^[]{}()\\.$*+?|")
 */
String.prototype.escapeForRegExp = function () {
    return this.escapeCharacters("^[]{}()\\.$*+?|");
}