
CandidateElement = function (element, contentDocument) {
    this.element = element
    this.contentDocument = contentDocument;
    this.textNodes = this.usableTextNodesInElement(this.element);
    this.rawScore = this.calculateRawScore();
    this.regExBonusMultiplier = this.calculateRegExBonus();
    this.languageScoreMultiplier = 0;
    this.depthInDocument = 0;
}
CandidateElement.extraArticleCandidateIfElementIsViable = function extraArticleCandidateIfElementIsViable(element, selectedArticle, contentDocument, isPrepended) {
    const InlineTextContainerTagNames = "a, b, strong, i, em, u, span";
    var documentRect = cachedElementBoundingRect(element);
    var selectedArticleRect = cachedElementBoundingRect(selectedArticle.element);
    if ((isPrepended && documentRect.height < PrependedArticleCandidateMinimumHeight) || (!isPrepended && documentRect.height < AppendedArticleCandidateMinimumHeight)) {
        if (element.childElementCount && element.querySelectorAll("*").length != element.querySelectorAll(InlineTextContainerTagNames).length)
            return null;
    }
    if (isPrepended) {
        if (documentRect.bottom > selectedArticleRect.top)
            return null;
    } else {
        if (documentRect.top < selectedArticleRect.bottom)
            return null;
    }
    if (!isPrepended) {
        var distanceFromArticle = documentRect.top - selectedArticleRect.bottom;
        console.assert(distanceFromArticle > 0, "An appended article node must be below the article");
        if (distanceFromArticle > AppendedArticleCandidateMaximumVerticalDistanceFromArticle)
            return null;
    }
    var maxDelta = 0.1 * selectedArticleRect.width;
    if (Math.abs(documentRect.left - selectedArticleRect.left) > maxDelta || Math.abs(documentRect.right - selectedArticle.right) > maxDelta)
        return null;
    var candidate = new CandidateElement(element, contentDocument);
    candidate.isPrepended = isPrepended;
    return candidate;
}
CandidateElement.candidateIfElementIsViable = function candidateIfElementIsViable(element, contentDocument, isForSimilarClass) {
    var documentRect = cachedElementBoundingRect(element);
    if (isForSimilarClass)
        return new CandidateElement(element, contentDocument);
    if (documentRect.width < CandidateMinimumWidth || documentRect.height < CandidateMinimumHeight)
        return null;
    if (documentRect.width * documentRect.height < CandidateMinimumArea)
        return null;
    if (documentRect.top > CandidateMaximumTop)
        return null;
    if (CandidateElement.candidateElementAdjustedHeight(element) < CandidateMinimumHeight)
        return null;
    return new CandidateElement(element, contentDocument);
}
CandidateElement.candidateElementAdjustedHeight = function candidateElementAdjustedHeight(element) {
    var documentRect = cachedElementBoundingRect(element);
    var adjustedHeight = documentRect.height;
    var indicatorElements = element.querySelectorAll("form");
    for (var i = 0; i < indicatorElements.length; i++) {
        var indicatorElement = indicatorElements[i];
        var indicatorRect = cachedElementBoundingRect(indicatorElement);
        if (indicatorRect.width > documentRect.width * CandidateMinimumWidthPortionForIndicatorElements)
            adjustedHeight -= indicatorRect.height;
    }
    var listContainers = element.querySelectorAll("ol, ul");
    var listContainersCount = listContainers.length;
    var lastListContainerSubstracted = null;
    for (var i = 0; i < listContainersCount; i++) {
        var listContainer = listContainers[i];
        if (lastListContainerSubstracted && lastListContainerSubstracted.compareDocumentPosition(listContainer) & DocumentPositionContainedBy)
            continue;
        var listItems = listContainer.querySelectorAll("li");
        var listItemCount = listItems.length;
        var listRect = cachedElementBoundingRect(listContainer);
        if (!listItemCount) {
            adjustedHeight -= listRect.height;
            continue;
        }
        var averageListItemHeight = listRect.height / listItemCount;
        var firstListItemStyle = getComputedStyle(listItems[0]);
        var listLineHeight = parseInt(firstListItemStyle.lineHeight);
        if (isNaN(listLineHeight)) {
            var listFontSize = fontSizeFromComputedStyle(firstListItemStyle);
            listLineHeight = listFontSize * BaseLineHeightRatio;
        }
        if (listRect.width > documentRect.width * CandidateMinimumWidthPortionForIndicatorElements && ((averageListItemHeight / listLineHeight) < CandidateMinumumListItemLineCount)) {
            adjustedHeight -= listRect.height;
            lastListContainerSubstracted = listContainer;
        }
    }
    return adjustedHeight;
}
CandidateElement.prototype = {
    calculateRawScore: function calculateRawScore() {
        var score = 0;
        var textNodes = this.textNodes;
        for (var i = 0; i < textNodes.length; i++)
            score += this.rawScoreForTextNode(textNodes[i]);
        return score;
    },
    calculateRegExBonus: function calculateRegExBonus() {
        var regExBonusMultiplier = 1;
        for (var currentElement = this.element; currentElement; currentElement = currentElement.parentElement) {
            var currentElementId = currentElement.getAttribute("id");
            if (currentElementId) {
                if (ArticleRegEx.test(currentElementId))
                    regExBonusMultiplier += ArticleMatchBonus;
                if (CommentRegEx.test(currentElementId))
                    regExBonusMultiplier -= CommentMatchPenalty;
            }
            var currentElementClassName = currentElement.className;
            if (currentElementClassName && typeof currentElementClassName === "string") {
                if (ArticleRegEx.test(currentElementClassName))
                    regExBonusMultiplier += ArticleMatchBonus;
                if (CommentRegEx.test(currentElementClassName))
                    regExBonusMultiplier -= CommentMatchPenalty;
            }
        }
        return regExBonusMultiplier;
    },
    calculateLanguageScoreMultiplier: function calculateLanguageScoreMultiplier() {
        if (this.languageScoreMultiplier != 0)
            return;
        if (this.textNodes && this.textNodes.length > 0) {
            var numCharactersThatNeedMultiplier = 0;
            var textString = this.textNodes[0].nodeValue.trim();
            var length = Math.min(textString.length, 10);
            for (var i = 0; i < length; i++) {
                if (characterNeedsScoreMultiplier(textString[i]))
                    numCharactersThatNeedMultiplier++;
            }
            if (numCharactersThatNeedMultiplier >= length / 2) {
                this.languageScoreMultiplier = ScoreMultiplierForChineseJapaneseKorean;
                return;
            }
        }
        this.languageScoreMultiplier = 1;
    },
    depth: function depth() {
        if (!this.depthInDocument)
            this.depthInDocument = elementDepth(this.element);
        return this.depthInDocument;
    },
    finalScore: function finalScore() {
        this.calculateLanguageScoreMultiplier();
        return this.basicScore() * this.languageScoreMultiplier;
    },
    basicScore: function basicScore() {
        return this.rawScore * this.regExBonusMultiplier;
    },
    scoreDensity: function scoreDensity() {
        var ignoredArea = 0;
        var ignoredElement = this.element.querySelector(DensityExcludedElementSelector);
        if (ignoredElement)
            ignoredArea = ignoredElement.clientWidth * ignoredElement.clientHeight;
        var articleArea = cachedElementBoundingRect(this.element).width * cachedElementBoundingRect(this.element).height;
        var maximumImageArea = articleArea * MaximumContentImageAreaToArticleAreaRatio;
        var imageMinimumWidth = cachedElementBoundingRect(this.element).width * MinimumContentImageWidthToArticleWidthRatio;
        var imageElements = this.element.querySelectorAll("img");
        var imageCount = imageElements.length;
        for (var i = 0; i < imageCount; i++) {
            var imageRect = cachedElementBoundingRect(imageElements[i]);
            if (imageRect.width >= imageMinimumWidth && imageRect.height > MinimumContentImageHeight) {
                var imageArea = imageRect.width * imageRect.height;
                if (imageArea < maximumImageArea)
                    ignoredArea += imageArea;
            }
        }
        var score = this.basicScore();
        var area = articleArea - ignoredArea;
        var numberOfTextNodes = this.textNodes.length;
        var numberOfCountedTextNodes = 0;
        var sumOfFontSizes = 0;
        for (var i = 0; i < numberOfTextNodes; i++) {
            var parentNode = this.textNodes[i].parentNode;
            console.assert(parentNode, "parentNode of this.textNodes[i] cannot be nil");
            if (parentNode) {
                sumOfFontSizes += fontSizeFromComputedStyle(getComputedStyle(parentNode));
                numberOfCountedTextNodes++;
            }
        }
        var averageFontSize = BaseFontSize;
        if (numberOfCountedTextNodes)
            averageFontSize = sumOfFontSizes /= numberOfCountedTextNodes;
        this.calculateLanguageScoreMultiplier();
        return (score / area * 1000) * (averageFontSize / BaseFontSize) * this.languageScoreMultiplier;
    },
    usableTextNodesInElement: function usableTextNodesInElement(element) {
        var textNodes = [];
        if (!element)
            return textNodes;
        const tagNamesToIgnore = {
            "A": 1,
            "DD": 1,
            "DT": 1,
            "NOSCRIPT": 1,
            "OL": 1,
            "OPTION": 1,
            "PRE": 1,
            "SCRIPT": 1,
            "STYLE": 1,
            "TD": 1,
            "UL": 1
        };
        var xPathQuery = "text()|*/text()|*/a/text()|*/li/text()|*/span/text()|*/em/text()|*/i/text()|*/strong/text()|*/b/text()|*/font/text()|blockquote/*/text()|div[count(./p)=count(./*)]/p/text()";
        var xPathResults = this.contentDocument.evaluate(xPathQuery, element, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (var i = 0; i < xPathResults.snapshotLength; i++) {
            var textNode = xPathResults.snapshotItem(i);
            if (tagNamesToIgnore[textNode.parentNode.tagName])
                continue;
            if (isNodeWhitespace(textNode))
                continue;
            textNodes.push(textNode);
        }
        return textNodes;
    },
    addTextNodesFromCandidateElement: function addTextNodesFromCandidateElement(otherCandidateElement) {
        for (var j = 0; j < this.textNodes.length; j++)
            this.textNodes[j].alreadyCounted = true;
        var otherCandidateElementTextNodes = otherCandidateElement.textNodes;
        for (var j = 0; j < otherCandidateElementTextNodes.length; j++) {
            if (!otherCandidateElementTextNodes[j].alreadyCounted)
                this.textNodes.push(otherCandidateElementTextNodes[j]);
        }
        for (var j = 0; j < this.textNodes.length; j++)
            this.textNodes[j].alreadyCounted = null;
        this.rawScore = this.calculateRawScore();
    },
    rawScoreForTextNode: function rawScoreForTextNode(textNode) {
        const TextNodeMinimumLength = 20;
        const TextNodeLengthPower = 1.25;
        if (!textNode)
            return 0;
        var length = textNode.length;
        if (length < TextNodeMinimumLength)
            return 0;
        var ancestor = textNode.parentNode;
        if (!isElementVisible(ancestor))
            return 0;
        var multiplier = 1;
        while (ancestor && ancestor != this.element) {
            multiplier -= 0.1;
            ancestor = ancestor.parentNode;
        }
        return Math.pow(length * multiplier, TextNodeLengthPower);
    },
    shouldDisqualifyDueToScoreDensity: function shouldDisqualifyDueToScoreDensity() {
        if (this.scoreDensity() < ArticleMinimumScoreDensity)
            return true;
        return false;
    },
    shouldDisqualifyDueToHorizontalRuleDensity: function shouldDisqualifyDueToHorizontalRuleDensity() {
        var horizontalRules = this.element.querySelectorAll("hr");
        var numberOfHRs = horizontalRules.length;
        var numberOfHRsToCount = 0;
        var elementRect = cachedElementBoundingRect(this.element);
        var minimumWidthToCount = elementRect.width * 0.70;
        for (var i = 0; i < numberOfHRs; i++) {
            if (horizontalRules[i].clientWidth > minimumWidthToCount)
                numberOfHRsToCount++;
        }
        if (numberOfHRsToCount) {
            var averageDistanceBetweenHRs = elementRect.height / numberOfHRsToCount;
            if (averageDistanceBetweenHRs < MinimumAverageDistanceBetweenHRElements)
                return true;
        }
        return false;
    },
    shouldDisqualifyDueToHeaderDensity: function shouldDisqualifyDueToHeaderDensity() {
        var headerLinksXPathQuery = "(h1|h2|h3|h4|h5|h6|*/h1|*/h2|*/h3|*/h4|*/h5|*/h6)[a]";
        var headerLinkResults = this.contentDocument.evaluate(headerLinksXPathQuery, this.element, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (headerLinkResults.snapshotLength > 2) {
            var numberOfHeadersToCount = 0;
            var elementRect = cachedElementBoundingRect(this.element);
            var topBottomIgnoreDistance = elementRect.height * PortionOfCandidateHeightToIgnoreForHeaderCheck;
            for (var i = 0; i < headerLinkResults.snapshotLength; i++) {
                var header = headerLinkResults.snapshotItem(i);
                var headerRect = cachedElementBoundingRect(header);
                if (headerRect.top - elementRect.top > topBottomIgnoreDistance && elementRect.bottom - headerRect.bottom > topBottomIgnoreDistance)
                    numberOfHeadersToCount++;
            }
            var averageDistanceBetweenHeaders = elementRect.height / numberOfHeadersToCount;
            if (averageDistanceBetweenHeaders < MinimumAverageDistanceBetweenHeaderElements)
                return true;
        }
        return false;
    },
    shouldDisqualifyDueToSimilarElements: function shouldDisqualifyDueToSimilarElements(candidateElements) {
        var baseElement = this.element;
        var candidateClass = baseElement.getAttribute("class");
        if (!candidateClass) {
            baseElement = baseElement.parentElement;
            if (baseElement) {
                candidateClass = baseElement.getAttribute("class");
                if (!candidateClass) {
                    baseElement = baseElement.parentElement;
                    if (baseElement)
                        candidateClass = baseElement.getAttribute("class");
                }
            }
        }
        if (candidateClass) {
            if (candidateElements === undefined)
                candidateElements = [];
            for (var i = 0; i < candidateElements.length; i++)
                candidateElements[i].element.candidateElement = candidateElements[i];
            var elementsOfSameClass;
            try {
                var classNames = candidateClass.split(" ");
                var classQuery = "";
                for (var j = 0; j < classNames.length; j++) {
                    if (classNames[j].length)
                        classQuery += "." + classNames[j];
                }
                elementsOfSameClass = this.contentDocument.querySelectorAll(classQuery);
            } catch (exception) {
                elementsOfSameClass = [];
            }
            var skippedPossiblePrependCandidate = false;
            var baseElementDepth = elementDepth(baseElement);
            for (var i = 0; i < elementsOfSameClass.length; i++) {
                var element = elementsOfSameClass[i];
                if (element == baseElement)
                    continue;
                if (element.parentElement == baseElement || baseElement.parentElement == element)
                    continue;
                if (!isElementVisible(element))
                    continue;
                var candidate = element.candidateElement;
                if (!candidate) {
                    candidate = CandidateElement.candidateIfElementIsViable(element, this.contentDocument, true);
                    if (!candidate)
                        continue;
                }
                if (candidate.basicScore() * ReaderMinimumAdvantage > this.basicScore()) {
                    if (!skippedPossiblePrependCandidate && cachedElementBoundingRect(element).bottom < cachedElementBoundingRect(this.element).top) {
                        skippedPossiblePrependCandidate = true;
                        continue;
                    }
                    if (element.previousElementSibling != null && baseElement.previousElementSibling != null && element.previousElementSibling.className == baseElement.previousElementSibling.className)
                        return true;
                    if (element.nextElementSibling != null && baseElement.nextElementSibling != null && element.nextElementSibling.className == baseElement.nextElementSibling.className)
                        return true;
                    if (elementDepth(element) == baseElementDepth) {
                        while (element.parentElement != null && baseElement.parentElement != null) {
                            if (element.parentElement == baseElement.parentElement)
                                break;
                            element = element.parentElement;
                            baseElement = baseElement.parentElement;
                        }
                    }
                    while (baseElement.childElementCount <= 1) {
                        if (!baseElement.childElementCount || !element.childElementCount)
                            return false;
                        if (element.childElementCount > 1)
                            return false;
                        if (baseElement.firstElementChild.tagName !== element.firstElementChild.tagName)
                            return false;
                        baseElement = baseElement.firstElementChild;
                        element = element.firstElementChild;
                    }
                    if (element.childElementCount <= 1)
                        return false;
                    var elementHeader = element.firstElementChild;
                    var elementFooter = element.lastElementChild;
                    var baseElementHeader = baseElement.firstElementChild;
                    var baseElementFooter = baseElement.lastElementChild;
                    if (elementHeader.tagName !== baseElementHeader.tagName)
                        return false;
                    if (elementFooter.tagName !== baseElementFooter.tagName)
                        return false;
                    var headerClass = elementHeader.className;
                    var footerClass = elementFooter.className;
                    var baseHeaderClass = baseElementHeader.className;
                    var baseFooterClass = elementFooter.className;
                    var acceptableNumberOfElementsWithClassName = (baseFooterClass == baseHeaderClass) ? 2 : 1;
                    if (headerClass.length || baseHeaderClass.length) {
                        if (!headerClass.length || !baseHeaderClass.length)
                            return false;
                        if (headerClass == baseHeaderClass) {
                            if (baseElement.querySelectorAll("." + baseHeaderClass.replace(/\s+/, ".")).length <= acceptableNumberOfElementsWithClassName)
                                return true;
                        }
                    }
                    if (footerClass.length || baseFooterClass.length) {
                        if (!footerClass.length || !baseFooterClass.length)
                            return false;
                        if (footerClass == baseFooterClass && baseElement.querySelectorAll("." + baseFooterClass.replace(/\s+/, ".")).length <= acceptableNumberOfElementsWithClassName)
                            return true;
                    }
                    var baseHeaderHeight = baseElementHeader.clientHeight;
                    var baseFooterHeight = baseElementFooter.clientHeight;
                    if (!baseHeaderHeight || !elementHeader.clientHeight)
                        return false;
                    if (!baseFooterHeight || !elementFooter.clientHeight)
                        return false;
                    if (baseHeaderHeight == elementHeader.clientHeight || baseFooterHeight == elementFooter.clientHeight)
                        return true;
                    return false;
                }
            }
            for (var i = 0; i < candidateElements.length; i++)
                candidateElements[i].element.candidateElement = null;
        }
        return false;
    }
}