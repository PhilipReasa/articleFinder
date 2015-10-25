
/*
 * UTILITY FUNCTIONS
 */
/**
 * Determines if the element passed in via parameter _element_ should be ignored based. There are two
 * cases that the tag may be ignored:
 * 1. The tag was present in the const _CandidateTagNamesToIgnore_
 * 2. One of the tags parents was in _CandidateTagNamesToIgnoreDescendantsOf_
 * @param {object} element - the dom node to consider ignoring
 * @return {boolean} True if the element should be ignored, else false
 */
function shouldIgnoreElementBySelfOrAncestorTagName(element) {
    if (CandidateTagNamesToIgnore[element.tagName])
        return true;
    for (var ancestor = element; ancestor; ancestor = ancestor.parentNode)
        if (CandidateTagNamesToIgnoreDescendantsOf[ancestor.tagName])
            return true;
    return false;
}

/**
 * Takes in a HTML node and returns true if it is "whitespace".
 * Whitespace is defined as:
 * * a non text node AND
 * * the node.data is not regex whitespace
 * @param {object} node - HTML node that we want to know if is whitespace
 * @return {boolean} true if the node is a whitespace node, false otherwise
 */
function isNodeWhitespace(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE)
        return false;
    return !/\S/.test(node.data);
}

/**
 * Removes whitespace from string
 * @param {string} string - the string to have whitespace removed from
 * @return {string} the passed in string with whitespace removed
 */
function removeWhitespace(string) {
    return string.replace(/\s+/g, '');
}

/**
 * Determines if the node passes is an element node
 * @param {object} node - the node to be evaluated
 * @return {boolean} True if the node passed in is a element node
 */
function isElementNode(node) {
    return (node && node.nodeType === Node.ELEMENT_NODE);
}

/**
 * Determines the debth from the root for a specific element
 * @param {object} element - the element to be evaluated
 * @return {int} the depth from the root.
 */
function elementDepth(element) {
    var depth = 0;
    while (element) {
        element = element.parentElement;
        depth++;
    }
    return depth;
}

/**
 * Utility to determin if the passed in element has any ancestor of the type _tagName_.
 * This function walks through the parents of the element looking for a parent of type
 * _tagName_.
 * @param {object} element - the element whose ancestors will be considered
 * @param {string} tagName - the type of ancestor we are looking for
 * @return {boolean} true if there is a parent of type _tagName_
 */
function elementHasAncestorWithTagName(element, tagName) {
    var node = element;
    while (node.parentNode) {
        node = node.parentNode;
        if (node.tagName === tagName)
            return true;
    }
    return false;
}

/**
 * Utility to return the text of an element. Checks:
 * 1. element.innerText
 * 2. If that fails, element.textContent
 * @param {object} element - the element to extract text from
 * @returns {string} the text from the element
 */
function innerTextOrTextContent(element) {
    var text = element.innerText; //prefer "what is actually shown to user"
    if (!text)
        text = element.textContent; //fall back to "all text"
    return text;
}

/**
 * Utility to find the [levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance).
 * In sort this puts a number to "how different" two strings are
 * @params {string} s - the first string
 * @params {string} t - the second string in the equeation
 * @return {int} the levenshtein distance between s and t
 */
function levenshteinDistance(s, t) {
    var m = s.length;
    var n = t.length;
    var d = new Array(m + 1);
    for (var i = 0; i < m + 1; i++) {
        d[i] = new Array(n + 1);
        d[i][0] = i;
    }
    for (var j = 0; j < n + 1; j++)
        d[0][j] = j;
    for (var j = 1; j < n + 1; j++) {
        for (var i = 1; i < m + 1; i++) {
            if (s[i - 1] === t[j - 1])
                d[i][j] = d[i - 1][j - 1];
            else {
                var deletion = d[i - 1][j] + 1;
                var insertion = d[i][j - 1] + 1;
                var substitution = d[i - 1][j - 1] + 1;
                d[i][j] = Math.min(deletion, insertion, substitution);
            }
        }
    }
    return d[m][n];
}

/**
 * A wrapper on levenshteinDistance that gives a normilized number for how different two string are
 * @params {string} s - the first string
 * @params {string} t - the second string in the equeation
 * @return {number} the levenshtein distance divided by the longest of the two strings
 */
function stringSimilarity(s, t) {
    var maxLength = Math.max(s.length, t.length);
    return maxLength ? (maxLength - levenshteinDistance(s, t)) / maxLength : 0;
}
