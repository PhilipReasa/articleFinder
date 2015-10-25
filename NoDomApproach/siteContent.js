/*
 * Modified Version of Apples Reader JS.
 * Modified to deal with the fact that we are not rendering this content. Therefore we cannot
 * use window/document functions like getComputedStyle.
 */

/**
 * @class articleFinder
 * @param {object} contentDocument - the html document to look for a article in
 */
ArticleFinder = function (contentDocument) {
    this.contentDocument = contentDocument;
    this.didSearchForArticleNode = false;
    this.article = null;
    this.didSearchForExtraArticleNode = false;
    this.extraArticle = null;
    this.leadingImage = null;
    this._elementsWithCachedBoundingRects = [];
    this._cachedContentTextStyle = null;
    this.pageNumber = 1;
    this.prefixWithDateForNextPageURL = null;
}
ArticleFinder.prototype = {
    isReaderModeAvailable: function isReaderModeAvailable() {
        this.cacheWindowScrollPosition();
        var article = this.articleNode();
        return article != null;
    },
    prepareToTransitionToReader: function prepareToTransitionToReader() {
        clearCachedElementBoundingRects();
        this.cacheWindowScrollPosition();
        this.adoptableArticle(true);
        this.nextPageURL();
        this.articleIsLTR();
    },
    nextPageURL: function nextPageURL() {
        if (this._nextPageURL === undefined) {
            var nextPageURLString = this.nextPageURLString();
            if (nextPageURLString) {
                nextPageURLString = ArticleFinderJSController.substituteURLForNextPageURL(nextPageURLString);
            }
            this._nextPageURL = nextPageURLString;
        }
        return this._nextPageURL;
    },
    classNameIsSignificantInRouteComputation: function classNameIsSignificantInRouteComputation(className) {
        if (!className)
            return false;
        return !(className.toLowerCase() in StylisticClassNames);
    },
    shouldIgnoreInRouteComputation: function shouldIgnoreInRouteComputation(element) {
        if (element.tagName === "SCRIPT" || element.tagName === "LINK" || element.tagName === "STYLE")
            return true;
        if (element.tagName !== "TR")
            return false;
        if (element.offsetHeight)
            return false;
        return true;
    },
    routeToArticleNode: function routeToArticleNode() {
        var hint = [];
        var currentElement = this.articleNode();
        while (currentElement) {
            var step = {};
            step.tagName = currentElement.tagName;
            if (currentElement.id)
                step.id = currentElement.id;
            if (this.classNameIsSignificantInRouteComputation(currentElement.className))
                step.className = currentElement.className;
            step.index = 1;
            for (var sibling = currentElement.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
                if (!this.shouldIgnoreInRouteComputation(sibling))
                    step.index++;
            }
            hint.unshift(step);
            currentElement = currentElement.parentElement;
        }
        return hint;
    },
    articleNode: function articleNode(forceFindingArticle) {
        if (!this.didSearchForArticleNode || forceFindingArticle) {
            this.article = this.findArticle(forceFindingArticle);
            this.didSearchForArticleNode = true;
            if (this.article)
                this.articleIsLTR();
        }
        return this.article ? this.article.element : null;
    },
    extraArticleNode: function extraArticleNode() {
        if (!this.didSearchForArticleNode)
            this.articleNode();
        if (!this.didSearchForExtraArticleNode) {
            this.extraArticle = this.findExtraArticle();
            this.didSearchForExtraArticleNode = true;
        }
        return this.extraArticle ? this.extraArticle.element : null;
    },
    contentTextStyle: function contentTextStyle() {
        if (this._cachedContentTextStyle)
            return this._cachedContentTextStyle;
        this._cachedContentTextStyle = contentTextStyleForNode(this.contentDocument, this.articleNode(), false);
        if (!this._cachedContentTextStyle)
            this._cachedContentTextStyle = getComputedStyle(this.articleNode());
        return this._cachedContentTextStyle;
    },
    commaCountIsLessThan: function commaCountIsLessThan(node, limit) {
        var count = 0;
        var textContent = node.textContent;
        var i = -1;
        while (count < limit && (i = textContent.indexOf(',', i + 1)) >= 0)
            count++;
        return count < limit;
    },
    calculateLinkDensity: function calculateLinkDensity(element) {
        var textLength = removeWhitespace(element.textContent).length;
        if (!textLength)
            return 0;
        var links = element.querySelectorAll("a");
        var linkCharacterCount = 0;
        for (var i = 0; i < links.length; i++)
            linkCharacterCount += removeWhitespace(links[i].textContent).length;
        return linkCharacterCount / textLength;
    },
    shouldPruneElement: function shouldPruneElement(element, originalElement) {
        const MaxInputToParagraphRatio = 0.33;
        const MaxPositiveWeightLinkDensity = 0.5;
        const MaxStandardLinkDensity = 0.2;
        const MinimumTextLength = 25;
        const MinimumAverageImageArea = 200 * 200;
        if (!element.parentElement)
            return false;
        if (element.tagName !== "OBJECT" && element.tagName !== "EMBED" && element.tagName !== "CANVAS") {
            var hasElementOrTextNodeChild = false;
            for (var i = 0; i < element.childNodes.length; i++) {
                var node = element.childNodes[i];
                var nodeType = node.nodeType;
                if (nodeType === Node.ELEMENT_NODE || (nodeType === Node.TEXT_NODE && !isNodeWhitespace(node))) {
                    hasElementOrTextNodeChild = true;
                    break;
                }
            }
            if (!hasElementOrTextNodeChild)
                return true;
        }
        if (element.tagName === "CANVAS")
            return element.parentNode.tagName === "CUFON";
        var classIdWeight = 0;
        if (originalElement) {
            if (PositiveRegEx.test(originalElement.className))
                classIdWeight++;
            if (PositiveRegEx.test(originalElement.id))
                classIdWeight++;
            if (NegativeRegEx.test(originalElement.className))
                classIdWeight--;
            if (NegativeRegEx.test(originalElement.id))
                classIdWeight--;
        }
        if (classIdWeight < 0)
            return true;
        if (element.tagName === "UL") {
            if (originalElement.querySelector("iframe") && originalElement.querySelector("script"))
                return true;
            return false;
        }
        if (element.tagName === "OBJECT") {
            const PlugInsToKeepRegEx = /youtube|vimeo|dailymotion/;
            var embedElement = element.querySelector("embed[src]");
            if (embedElement && PlugInsToKeepRegEx.test(embedElement.src))
                return false;
            var dataAttribute = element.getAttribute("data");
            if (dataAttribute && PlugInsToKeepRegEx.test(dataAttribute))
                return false;
            return true;
        }
        if (element.childElementCount === 1) {
            var childElement = element.firstElementChild;
            if (childElement.tagName === "A")
                return false;
            if (childElement.tagName === "SPAN" && childElement.className === "converted-anchor" && elementHasAncestorWithTagName(childElement, "TABLE"))
                return false;
        }
        var imageElements = element.querySelectorAll("img");
        var imageElementCount = imageElements.length;
        if (imageElementCount) {
            var averageImageArea = 0;
            for (var i = 0; i < imageElementCount; i++) {
                var originalImage = imageElements[i].originalElement;
                if (!isElementVisible(originalImage))
                    continue;
                var originalRect = cachedElementBoundingRect(originalImage);
                averageImageArea += (originalRect.width / imageElementCount) * (originalRect.height / imageElementCount);
            }
            if (averageImageArea > MinimumAverageImageArea)
                return false;
        }
        if (!this.commaCountIsLessThan(element, 10))
            return false;
        var p = element.querySelectorAll("p").length;
        var br = element.querySelectorAll("br").length;
        var numParagraphs = p + Math.floor(br / 2);
        if (imageElementCount > numParagraphs)
            return true;
        if (element.querySelectorAll("li").length > numParagraphs)
            return true;
        if (element.querySelectorAll("input").length / numParagraphs > MaxInputToParagraphRatio)
            return true;
        if (element.textContent.length < MinimumTextLength && (imageElementCount != 1))
            return true;
        if (element.querySelector("embed"))
            return true;
        var linkDensity = this.calculateLinkDensity(element);
        if (classIdWeight >= 1 && linkDensity > MaxPositiveWeightLinkDensity)
            return true;
        if (classIdWeight < 1 && linkDensity > MaxStandardLinkDensity)
            return true;
        if (element.tagName === "TABLE") {
            var textLength = removeWhitespace(element.innerText).length;
            var originalTextLength = removeWhitespace(originalElement.innerText).length;
            if (textLength <= (originalTextLength * 0.5))
                return true;
        }
        return false;
    },
    wordCountIsLessThan: function wordCountIsLessThan(node, limit) {
        var count = 0;
        var textContent = node.textContent;
        var i = -1;
        while ((i = textContent.indexOf(' ', i + 1)) >= 0 && count < limit)
            count++;
        return count < limit;
    },
    leadingImageIsAppropriateWidth: function leadingImageIsAppropriateWidth(image) {
        if (!this.article || !image)
            return false;
        return image.getBoundingClientRect().width >= this.article.element.getBoundingClientRect().width;
    },
    newDivFromNode: function newDivFromNode(node) {
        var div = this.contentDocument.createElement("div");
        if (node)
            div.innerHTML = node.innerHTML;
        return div;
    },
    adoptableLeadingImage: function adoptableLeadingImage() {
        const LeadingImageMaximumContainerChildren = 5;
        const LeadingImageMinimumAbsoluteWidth = 600;
        const LeadingImageCreditRegex = /credit/;
        const LeadingImageCaptionRegex = /caption/;
        const LeadingImageAttributeToKeepRegex = /src|alt/;
        if (!this.article || !this.leadingImage || !this.leadingImageIsAppropriateWidth(this.leadingImage))
            return null;
        var leadingImageContainer = this.leadingImage.parentNode;
        var originalCredit = null;
        var originalCaption = null;
        var numChildren = leadingImageContainer.children.length;
        if (leadingImageContainer.tagName === "DIV" && numChildren > 1 && numChildren < LeadingImageMaximumContainerChildren) {
            var texts = leadingImageContainer.cloneNode(true).querySelectorAll("p, div");
            for (var i = 0, length = texts.length; i < length; i++) {
                var text = texts[i];
                if (LeadingImageCreditRegex.test(text.className))
                    originalCredit = text.cloneNode(true);
                else if (LeadingImageCaptionRegex.test(text.className))
                    originalCaption = text.cloneNode(true);
            }
        }
        var image = this.leadingImage.cloneNode(false);
        var attributes = image.attributes;
        for (var i = 0; i < attributes.length; i++) {
            var attributeName = attributes[i].nodeName;
            if (!LeadingImageAttributeToKeepRegex.test(attributeName)) {
                image.removeAttribute(attributeName);
                i--;
            }
        }
        image.className = image.width >= LeadingImageMinimumAbsoluteWidth ? "full-width" : null;
        var container = this.contentDocument.createElement("div");
        container.className = "leading-image";
        container.appendChild(image);
        if (originalCredit) {
            var credit = this.newDivFromNode(originalCredit);
            credit.className = "credit";
            container.appendChild(credit);
        }
        if (originalCaption) {
            var caption = this.newDivFromNode(originalCaption);
            caption.className = "caption";
            container.appendChild(caption);
        }
        return container;
    },
    adoptableArticle: function adoptableArticle(forceFindingArticle) {
        if (this._adoptableArticle !== undefined) {
            return this._adoptableArticle.cloneNode(true);
        }
        var rootElement = this.articleNode(forceFindingArticle);
        this._adoptableArticle = rootElement ? rootElement.cloneNode(true) : null;
        if (!this._adoptableArticle)
            return this._adoptableArticle;
        this._adoptableArticle = this.cleanArticleNode(rootElement, this._adoptableArticle, false)
        var extraArticle = this.extraArticleNode();
        if (extraArticle) {
            var cleanedExtraNode = this.cleanArticleNode(extraArticle, extraArticle.cloneNode(true), true);
            if (cleanedExtraNode) {
                if (this.extraArticle.isPrepended)
                    this._adoptableArticle.insertBefore(cleanedExtraNode, this._adoptableArticle.firstChild);
                else
                    this._adoptableArticle.appendChild(cleanedExtraNode);
            }
        }
        this._articleTextContent = this._adoptableArticle.innerText;
        var leadingImage = this.adoptableLeadingImage();
        if (leadingImage)
            this._adoptableArticle.insertBefore(leadingImage, this._adoptableArticle.firstChild);
        return this._adoptableArticle;
    },
    cleanArticleNode: function cleanArticleNode(originalArticleNode, clonedArticleNode, allowedToReturnNull) {
        const tagNamesToAlwaysPrune = {
            "FORM": 1,
            "IFRAME": 1,
            "SCRIPT": 1,
            "STYLE": 1,
            "LINK": 1
        };
        const tagNamesToConsiderPruning = {
            "DIV": 1,
            "TABLE": 1,
            "OBJECT": 1,
            "UL": 1,
            "CANVAS": 1
        };
        const tagNamesAffectingFontStyle = {
            "I": 1,
            "EM": 1
        };
        const tagNamesAffectingFontWeight = {
            "B": 1,
            "STRONG": 1,
            "H1": 1,
            "H2": 1,
            "H3": 1,
            "H4": 1,
            "H5": 1,
            "H6": 1
        };
        const MaximumFloatingContentRatio = 0.8;
        var elementsToConsiderPruning = [];
        var depthInFloat = 0;
        var depthInTable = 0;
        var depthInFontStyle = 0;
        var depthInFontWeight = 0;
        var currentElement = originalArticleNode;
        var view = currentElement.ownerDocument.defaultView;
        var currentCloneElement = clonedArticleNode;
        var articleTitle = this.articleTitle();
        var articleTitleElement = this._articleTitleElement;

        function incrementDepthLevels(delta) {
            if (depthInFloat)
                depthInFloat += delta;
            if (depthInTable)
                depthInTable += delta;
            if (depthInFontStyle)
                depthInFontStyle += delta;
            if (depthInFontWeight)
                depthInFontWeight += delta;
        };

        function updateDepthLevelsAfterSiblingTraversal() {
            if (depthInFloat === 1)
                depthInFloat = 0;
            if (depthInTable === 1)
                depthInTable = 0;
            if (depthInFontStyle === 1)
                depthInFontStyle = 0;
            if (depthInFontWeight === 1)
                depthInFontWeight = 0;
        };
        var articleRect = cachedElementBoundingRect(originalArticleNode);
        var articleArea = articleRect.width * articleRect.height;
        var childFloatArea = 0;
        var articleChildren = originalArticleNode.children;
        for (var i = 0; i < articleChildren.length; i++) {
            var child = articleChildren[i];
            if (getComputedStyle(child).float === "none")
                continue;
            var childRect = cachedElementBoundingRect(child);
            childFloatArea += childRect.width * childRect.height;
        }
        var mostOfDocumentIsFloat = childFloatArea / articleArea > MaximumFloatingContentRatio;
        while (currentElement) {
            var prunedElement = null;
            var tagName = currentCloneElement.tagName;
            currentCloneElement.originalElement = currentElement;
            if (tagName in tagNamesToAlwaysPrune)
                prunedElement = currentCloneElement;
            if (!prunedElement && currentElement === articleTitleElement)
                prunedElement = currentCloneElement;
            if (!prunedElement && (tagName === "H1" || tagName === "H2")) {
                var distanceFromoriginalArticleNodeTop = currentElement.offsetTop - originalArticleNode.offsetTop;
                if (distanceFromoriginalArticleNodeTop < HeaderMinimumDistanceFromArticleTop) {
                    var headerText = innerTextOrTextContent(currentElement);
                    var maxDistanceToConsiderSimilar = headerText.length * HeaderLevenshteinDistanceToLengthRatio;
                    if (levenshteinDistance(articleTitle, headerText) <= maxDistanceToConsiderSimilar)
                        prunedElement = currentCloneElement;
                }
            }
            if (!prunedElement) {
                if (this.isMediaWikiPage() && currentElement.className === "editsection")
                    prunedElement = currentCloneElement;
            }
            var computedStyle;
            if (!prunedElement)
                computedStyle = getComputedStyle(currentElement);
            if (!prunedElement && tagName === "DIV" && currentCloneElement.parentNode) {
                var elements = currentElement.querySelectorAll("a, blockquote, dl, div, img, ol, p, pre, table, ul");
                var inFloat = depthInFloat || computedStyle["float"] !== "none";
                if (!inFloat && !elements.length) {
                    var parentNode = currentCloneElement.parentNode;
                    var replacementNode = this.contentDocument.createElement("p");
                    while (currentCloneElement.firstChild) {
                        var child = currentCloneElement.firstChild;
                        replacementNode.appendChild(child);
                    }
                    parentNode.replaceChild(replacementNode, currentCloneElement);
                    currentCloneElement = replacementNode;
                    currentCloneElement.originalElement = currentElement;
                    tagName = currentCloneElement.tagName;
                }
            }
            if (!prunedElement && currentCloneElement.parentNode && tagName in tagNamesToConsiderPruning)
                elementsToConsiderPruning.push(currentCloneElement);
            if (!prunedElement) {
                if (computedStyle.display === "none" || computedStyle.visibility !== "visible")
                    prunedElement = currentCloneElement;
                else if (currentElement !== originalArticleNode && tagName !== "IMG" && !depthInFloat && computedStyle["float"] !== "none" && !mostOfDocumentIsFloat && (cachedElementBoundingRect(currentElement).height >= FloatMinimumHeight || currentElement.childElementCount > 1))
                    depthInFloat = 1;
            }
            if (!prunedElement) {
                var attributes = currentCloneElement.attributes;
                for (var i = 0; i < attributes.length; i++) {
                    var attributeName = attributes[i].nodeName;
                    if (AttributesToRemoveRegEx.test(attributeName)) {
                        currentCloneElement.removeAttribute(attributeName);
                        i--;
                    }
                }
                if (!depthInFontStyle && computedStyle.fontStyle !== "normal") {
                    if (!(tagName in tagNamesAffectingFontStyle))
                        currentCloneElement.style.fontStyle = computedStyle.fontStyle;
                    depthInFontStyle = 1;
                }
                if (!depthInFontWeight && computedStyle.fontWeight !== "normal") {
                    if (!(tagName in tagNamesAffectingFontWeight))
                        currentCloneElement.style.fontWeight = computedStyle.fontWeight;
                    depthInFontWeight = 1;
                }
                if (depthInFloat) {
                    if (depthInFloat === 1) {
                        if (cachedElementBoundingRect(currentElement).width === cachedElementBoundingRect(originalArticleNode).width)
                            currentCloneElement.setAttribute("class", "float full-width");
                        else
                            currentCloneElement.setAttribute("class", "float " + computedStyle["float"]);
                    }
                    var widthValue = currentElement.style.getPropertyValue("width");
                    if (widthValue)
                        currentCloneElement.style.width = widthValue;
                    else {
                        var rules = view.getMatchedCSSRules(currentElement, "", true);
                        if (rules) {
                            for (var i = rules.length - 1; i >= 0; i--) {
                                widthValue = rules[i].style.getPropertyValue("width");
                                if (widthValue) {
                                    currentCloneElement.style.width = widthValue;
                                    break;
                                }
                            }
                        }
                    }
                    if (depthInFloat === 1 && !widthValue)
                        currentCloneElement.style.width = cachedElementBoundingRect(currentElement).width + "px";
                }
                if (tagName === "TABLE") {
                    if (!depthInTable)
                        depthInTable = 1;
                } else if (tagName === "IMG") {
                    currentCloneElement.removeAttribute("border");
                    currentCloneElement.removeAttribute("hspace");
                    currentCloneElement.removeAttribute("vspace");
                    currentCloneElement.removeAttribute("align");
                    if (!depthInFloat) {
                        var imageBoundingRect = cachedElementBoundingRect(currentElement);
                        if (imageBoundingRect.width < ImageSizeTiny && imageBoundingRect.height < ImageSizeTiny)
                            currentCloneElement.setAttribute("class", "reader-image-tiny");
                        else if ((imageBoundingRect.width / cachedElementBoundingRect(originalArticleNode).width) > ImageWidthToParentWidthRatio) {
                            currentCloneElement.setAttribute("class", "reader-image-large");
                        }
                    } else {
                        currentCloneElement.style.float = computedStyle.float;
                    }
                } else if (tagName === "FONT") {
                    currentCloneElement.removeAttribute("size");
                    currentCloneElement.removeAttribute("face");
                    currentCloneElement.removeAttribute("color");
                } else if (tagName === "A" && currentCloneElement.parentNode) {
                    var href = currentCloneElement.getAttribute("href");
                    if (href && href.length && (href[0] === "#" || href.substring(0, 11) === "javascript:")) {
                        if (!depthInTable && !currentCloneElement.childElementCount && currentCloneElement.parentElement.childElementCount === 1) {
                            var xPathResult = this.contentDocument.evaluate("text()", currentCloneElement.parentElement, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (!xPathResult.snapshotLength)
                                prunedElement = currentCloneElement;
                        }
                        if (!prunedElement) {
                            var replacementNode = this.contentDocument.createElement("span");
                            if (currentCloneElement.childElementCount === 1 && currentCloneElement.firstElementChild.tagName === "IMG") {
                                var imageElement = currentCloneElement.firstElementChild;
                                if (imageElement.width > AnchorImageMinimumWidth && imageElement.height > AnchorImageMinimumHeight)
                                    replacementNode.setAttribute("class", "converted-image-anchor");
                            }
                            if (!replacementNode.className)
                                replacementNode.setAttribute("class", "converted-anchor");
                            while (currentCloneElement.firstChild)
                                replacementNode.appendChild(currentCloneElement.firstChild);
                            currentCloneElement.parentNode.replaceChild(replacementNode, currentCloneElement);
                            currentCloneElement = replacementNode;
                        }
                    }
                }
            }
            var firstElementChild = prunedElement ? null : currentElement.firstElementChild;
            if (firstElementChild) {
                currentElement = firstElementChild;
                currentCloneElement = currentCloneElement.firstElementChild;
                incrementDepthLevels(1);
            } else {
                var nextElementSibling;
                while (currentElement !== originalArticleNode && !(nextElementSibling = currentElement.nextElementSibling)) {
                    currentElement = currentElement.parentElement;
                    currentCloneElement = currentCloneElement.parentElement;
                    incrementDepthLevels(-1);
                }
                if (currentElement === originalArticleNode) {
                    if (prunedElement) {
                        if (prunedElement.parentElement)
                            prunedElement.parentElement.removeChild(prunedElement);
                        else if (allowedToReturnNull)
                            return null;
                    }
                    break;
                }
                currentElement = nextElementSibling;
                currentCloneElement = currentCloneElement.nextElementSibling;
                updateDepthLevelsAfterSiblingTraversal();
            }
            if (prunedElement) {
                if (prunedElement.parentElement)
                    prunedElement.parentElement.removeChild(prunedElement);
                else if (allowedToReturnNull)
                    return null;
            }
        }
        for (var i = elementsToConsiderPruning.length - 1; i >= 0; i--) {
            var element = elementsToConsiderPruning[i];
            if (element.parentNode && this.shouldPruneElement(element, element.originalElement))
                element.parentNode.removeChild(element);
        }
        var floatElements = this._adoptableArticle.querySelectorAll(".float");
        for (var i = 0; i < floatElements.length; i++) {
            var pruneFloatedElement = false;
            var floatElement = floatElements[i];
            if (!pruneFloatedElement) {
                var anchors = floatElement.querySelectorAll("a, span.converted-image-anchor");
                var replacedAnchors = floatElement.querySelectorAll("span.converted-anchor");
                pruneFloatedElement = floatElement.parentNode && replacedAnchors.length > anchors.length;
            }
            if (!pruneFloatedElement) {
                var plugInsInClonedElement = floatElement.querySelectorAll("embed, object").length;
                var plugInsInOriginalElement = floatElement.originalElement.querySelectorAll("embed, object").length;
                if (!plugInsInClonedElement && plugInsInOriginalElement)
                    pruneFloatedElement = true;
            }
            if (!pruneFloatedElement) {
                var imagesInOriginalElement = floatElement.originalElement.querySelectorAll("img");
                var visibleImagesInOriginalElementCount = 0;
                for (var j = 0; j < imagesInOriginalElement.length; j++) {
                    if (isElementVisible(imagesInOriginalElement[j]))
                        visibleImagesInOriginalElementCount++;
                    if (visibleImagesInOriginalElementCount > 1)
                        break;
                }
                if (visibleImagesInOriginalElementCount === 1) {
                    var imagesInClonedElementCount = floatElement.querySelectorAll("img").length;
                    if (!imagesInClonedElementCount)
                        pruneFloatedElement = true;
                }
            }
            if (pruneFloatedElement)
                floatElement.parentNode.removeChild(floatElement);
        }
        if (allowedToReturnNull && !removeWhitespace(clonedArticleNode.innerText).length)
            return null;
        return clonedArticleNode;
    },
    leadingImageNode: function leadingImageNode() {
        const LeadingImageMinimumHeight = 250;
        const LeadingImageMinimumWidthRatio = 0.5;
        const LeadingImageNumberOfAncestorsToSearch = 3;
        var searchScope = this.article.element;
        for (var ancestorCount = 0; ancestorCount < LeadingImageNumberOfAncestorsToSearch; ancestorCount++) {
            if (!searchScope.parentNode)
                break;
            searchScope = searchScope.parentNode;
            var image = searchScope.getElementsByTagName("img")[0];
            if (image) {
                var imageRect = cachedElementBoundingRect(image);
                if (imageRect.height >= LeadingImageMinimumHeight && imageRect.width >= this._articleWidth * LeadingImageMinimumWidthRatio) {
                    var position = this.article.element.compareDocumentPosition(image);
                    if (!(position & DocumentPositionPreceding) || (position & DocumentPositionContainedBy))
                        continue;
                    position = this.extraArticle ? this.extraArticle.element.compareDocumentPosition(image) : null;
                    if (position && (!(position & DocumentPositionPreceding) || (position & DocumentPositionContainedBy)))
                        continue;
                    return image;
                }
            }
        }
        return null;
    },
    articleTitle: function articleTitle() {
        if (this._articleTitle !== undefined)
            return this._articleTitle;
        const HeaderMaximumDistance = 500;
        const HeaderMinimumTextLength = 8;
        const HeaderMinimumFontSize = 12;
        const HeaderFontSizeBonusMinimumRatio = 1.1;
        const HeaderFontSizeBonusMultiplier = 1.25;
        const HeaderBonusRegEx = /header|title|headline/i;
        const HeaderRegexBonusMultiplier = 1.5;
        const HeaderContentBonusMultiplier = 1.5;
        const HeaderMaximumDOMDistance = 9;
        const HeaderMinimumFontSizeDifference = 1.5;

        function isPrefixOrSuffix(headerText, documentTitle) {
            var position = headerText ? documentTitle.indexOf(headerText) : -1;
            return (position != -1 && (position == 0 || position + headerText.length == documentTitle.length));
        }
        var articleRect = cachedElementBoundingRect(this.articleNode());
        if (this.extraArticleNode() && this.extraArticle.isPrepended)
            articleRect = cachedElementBoundingRect(this.extraArticleNode());
        var articleCenterX = articleRect.left + (articleRect.width / 2);
        var articleTopY = articleRect.top;
        var articleAdjustedTopY = articleTopY;
        this._articleWidth = articleRect.width;
        this.leadingImage = this.leadingImageNode();
        if (this.leadingImage) {
            var imageRect = cachedElementBoundingRect(this.leadingImage);
            articleAdjustedTopY = imageRect.top;
        }
        var allHeaders = this.contentDocument.querySelectorAll("h1, h2, h3, h4, h5, .headline, .article_title, #hn-headline, .inside-head");
        var bestHeader;
        for (var i = 0; i < allHeaders.length; i++) {
            var header = allHeaders[i];
            var headerRect = cachedElementBoundingRect(header);
            var headerCenterX = headerRect.left + (headerRect.width / 2);
            var headerCenterY = headerRect.top + (headerRect.height / 2);
            var deltaX = headerCenterX - articleCenterX;
            var deltaY = headerCenterY - articleAdjustedTopY;
            var distance = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
            var headerScore = Math.max(HeaderMaximumDistance - distance, 0);
            if (distance > HeaderMaximumDistance)
                continue;
            if (headerCenterX < articleRect.left || headerCenterX > articleRect.right)
                continue;
            var headerFontSize = fontSizeFromComputedStyle(getComputedStyle(header));
            if (headerFontSize < HeaderMinimumFontSize)
                continue;
            var headerText = header.innerText;
            if (isPrefixOrSuffix(headerText, this.contentDocument.title))
                headerScore *= HeaderContentBonusMultiplier;
            else if (headerText.length < HeaderMinimumTextLength)
                continue;
            headerScore *= 1 + TitleCandidateDepthScoreMultiplier * elementDepth(header);
            headerScore *= (headerFontSize / BaseFontSize);
            var fontSize = parseInt(this.contentTextStyle().fontSize);
            if (parseInt(headerFontSize) > fontSize * HeaderFontSizeBonusMinimumRatio)
                headerScore *= HeaderFontSizeBonusMultiplier;
            if (HeaderBonusRegEx.test(header.className) || HeaderBonusRegEx.test(header.id))
                headerScore *= HeaderRegexBonusMultiplier;
            if (!bestHeader || headerScore > bestHeader.headerScore) {
                bestHeader = header;
                bestHeader.headerScore = headerScore;
                bestHeader.headerText = headerText;
            }
        }
        if (bestHeader && domDistance(bestHeader, this.articleNode(), HeaderMaximumDOMDistance + 1) > HeaderMaximumDOMDistance) {
            if (parseInt(getComputedStyle(bestHeader).fontSize) < HeaderMinimumFontSizeDifference * fontSize)
                bestHeader = null;
        }
        if (bestHeader) {
            this._articleTitle = bestHeader.headerText.trim();
            this._articleTitleElement = bestHeader;
        }
        if (!this._articleTitle)
            this._articleTitle = this.contentDocument.title;
        return this._articleTitle;
    },
    articleIsLTR: function articleIsLTR() {
        if (this._articleIsLTR === undefined) {
            var computedStyle = getComputedStyle(this.articleNode());
            this._articleIsLTR = computedStyle ? computedStyle.direction === "ltr" : true;
        }
        return this._articleIsLTR;
    },
    findSuggestedCandidate: function findSuggestedCandidate() {
        var route = this.suggestedRouteToArticle;
        if (!route || !route.length)
            return null;
        var node;
        var i;
        for (i = route.length - 1; i >= 0; i--) {
            if (route[i].id) {
                node = this.contentDocument.getElementById(route[i].id);
                if (node)
                    break;
            }
        }
        i++;
        if (!node)
            node = this.contentDocument;
        while (i < route.length) {
            var step = route[i];
            var child = node.nodeType === Node.DOCUMENT_NODE ? node.documentElement : node.firstElementChild;
            for (var j = 1; child && j < step.index; child = child.nextElementSibling) {
                if (!this.shouldIgnoreInRouteComputation(child))
                    j++;
            }
            if (!child)
                return null;
            if (child.tagName !== step.tagName)
                return null;
            if (step.className && child.className !== step.className)
                return null;
            node = child;
            i++;
        }
        if (!isElementVisible(node))
            return null;
        return new CandidateElement(node, this.contentDocument);
    },
    findArticleTagCandidateElement: function findArticleTagCandidateElement() {
        var articleTagElements = this.contentDocument.querySelectorAll("article");
        if (articleTagElements.length != 1)
            return null;
        return CandidateElement.candidateIfElementIsViable(articleTagElements[0], this.contentDocument);
    },
    canRunReaderDetection: function () {
        return true;
    },
    findArticle: function findArticle(forceFindingArticle) {
        if (!this.canRunReaderDetection())
            return null;
        var suggestedCandidate = this.findSuggestedCandidate();
        var candidateElements = this.findCandidateElements();
        if (!candidateElements || !candidateElements.length)
            return suggestedCandidate;
        if (suggestedCandidate && suggestedCandidate.basicScore() >= success)
            return suggestedCandidate;
        var articleTagElement = this.findArticleTagCandidateElement()
        if (articleTagElement)
            return articleTagElement;
        var highestScoringElement = this.highestScoringCandidateFromCandidates(candidateElements);
        if (highestScoringElement.element.tagName === "BLOCKQUOTE") {
            var blockquoteParent = highestScoringElement.element.parentNode;
            var numberOfCandidateElements = candidateElements.length;
            for (var i = 0; i < numberOfCandidateElements; i++) {
                var candidateElement = candidateElements[i];
                if (candidateElement.element === blockquoteParent) {
                    highestScoringElement = candidateElement;
                    break;
                }
            }
        }
        if (suggestedCandidate && highestScoringElement.finalScore() < success)
            return suggestedCandidate;
        if (highestScoringElement.shouldDisqualifyDueToScoreDensity()) {
            var elements = highestScoringElement.element.querySelectorAll("ul", "li");
            for (var i = 0; i < elements.length; i++) {
                var prohibitedListElementChildren = elements[i].querySelectorAll("a", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "table");
                if (prohibitedListElementChildren.length > 0)
                    continue;
                var textNodes = highestScoringElement.usableTextNodesInElement(elements[i]);
                if (!textNodes.length)
                    continue;
                for (var j = 0; j < textNodes.length; j++)
                    highestScoringElement.textNodes.push(textNodes[j]);
            }
            highestScoringElement.rawScore = highestScoringElement.calculateRawScore();
            if (!forceFindingArticle && highestScoringElement.shouldDisqualifyDueToScoreDensity())
                return null;
        }
        if (!forceFindingArticle) {
            if (highestScoringElement.shouldDisqualifyDueToHorizontalRuleDensity())
                return null;
            if (highestScoringElement.shouldDisqualifyDueToHeaderDensity())
                return null;
            if (highestScoringElement.shouldDisqualifyDueToSimilarElements(candidateElements))
                return null;
        }
        return highestScoringElement;
    },
    findExtraArticle: function findExtraArticle() {
        if (!this.article)
            return null;
        for (var i = 0, candidateSearchScope = this.article.element; i < 3 && candidateSearchScope; i++, candidateSearchScope = candidateSearchScope.parentNode) {
            var candidateElements = this.findExtraArticleCandidateElements(candidateSearchScope);
            if (!candidateElements || !candidateElements.length)
                continue;
            var sortedCandidateElements = this.sortCandidateElementsInDescendingScoreOrder(candidateElements);
            var highestScoringCandidate;
            for (var candidateIndex = 0; candidateIndex < sortedCandidateElements.length; candidateIndex++) {
                highestScoringCandidate = sortedCandidateElements[candidateIndex];
                if (!highestScoringCandidate || !highestScoringCandidate.basicScore())
                    break;
                if (highestScoringCandidate.shouldDisqualifyDueToScoreDensity())
                    continue;
                if (highestScoringCandidate.shouldDisqualifyDueToHorizontalRuleDensity())
                    continue;
                if (highestScoringCandidate.shouldDisqualifyDueToHeaderDensity())
                    continue;
                if (cachedElementBoundingRect(highestScoringCandidate.element).height < PrependedArticleCandidateMinimumHeight && cachedElementBoundingRect(this.article.element).width != cachedElementBoundingRect(highestScoringCandidate.element).width)
                    continue;
                var textNodeStyle = contentTextStyleForNode(this.contentDocument, highestScoringCandidate.element, true);
                if (!textNodeStyle)
                    continue;
                if (textNodeStyle.fontFamily !== this.contentTextStyle().fontFamily || textNodeStyle.fontSize !== this.contentTextStyle().fontSize)
                    continue;
                if (highestScoringCandidate)
                    return highestScoringCandidate;
            }
        }
        return null;
    },
    highestScoringCandidateFromCandidates: function highestScoringCandidateFromCandidates(candidateElements) {
        var highestScore = 0;
        var highestScoringElement = null;
        for (var i = 0; i < candidateElements.length; i++) {
            var candidateElement = candidateElements[i];
            var score = candidateElement.basicScore();
            if (score >= highestScore) {
                highestScore = score;
                highestScoringElement = candidateElement;
            }
        }
        return highestScoringElement;
    },
    sortCandidateElementsInDescendingScoreOrder: function sortCandidateElementsInDescendingScoreOrder(candidateElements) {
        function sortByScore(candidate1, candidate2) {
            if (candidate1.basicScore() != candidate2.basicScore())
                return candidate2.basicScore() - candidate1.basicScore();
            return candidate2.depth() - candidate1.depth();
        }
        return candidateElements.sort(sortByScore);
    },
    findCandidateElements: function findCandidateElements() {
        const MaximumCandidateDetectionTimeInterval = 1000;
        var findCandidateElementsTimeoutDate = Date.now() + MaximumCandidateDetectionTimeInterval;
        var elements = this.contentDocument.getElementsByTagName("*");
        var candidateElements = [];
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            if (shouldIgnoreElementBySelfOrAncestorTagName(element))
                continue;
            var candidate = CandidateElement.candidateIfElementIsViable(element, this.contentDocument);
            if (candidate)
                candidateElements.push(candidate);
            if (Date.now() > findCandidateElementsTimeoutDate) {
                console.assert(false, "ArticleFinder aborting CandidateElement detection due to timeout");
                candidateElements = [];
                break;
            }
        }
        for (var i = 0; i < candidateElements.length; i++)
            candidateElements[i].element.candidateElement = candidateElements[i];
        for (var i = 0; i < candidateElements.length; i++) {
            var candidateElement = candidateElements[i];
            if (candidateElement.element.tagName !== "BLOCKQUOTE")
                continue;
            var parentCandidateElement = candidateElement.element.parentElement.candidateElement;
            if (!parentCandidateElement)
                continue;
            parentCandidateElement.addTextNodesFromCandidateElement(candidateElement);
        }
        for (var i = 0; i < candidateElements.length; i++)
            candidateElements[i].element.candidateElement = null;
        return candidateElements;
    },
    findExtraArticleCandidateElements: function findExtraArticleCandidateElements(searchScope) {
        if (!this.article)
            return [];
        if (!searchScope)
            searchScope = this.article.element;
        var xPathQuery = "preceding-sibling::*/descendant-or-self::*";
        var xPathResults = this.contentDocument.evaluate(xPathQuery, searchScope, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var possibleCandidateCount = xPathResults.snapshotLength;
        var candidateElements = [];
        for (var i = 0; i < possibleCandidateCount; i++) {
            var element = xPathResults.snapshotItem(i);
            if (shouldIgnoreElementBySelfOrAncestorTagName(element))
                continue;
            var candidate = CandidateElement.extraArticleCandidateIfElementIsViable(element, this.article, this.contentDocument, true);
            if (candidate)
                candidateElements.push(candidate);
        }
        xPathQuery = "following-sibling::*/descendant-or-self::*";
        xPathResults = this.contentDocument.evaluate(xPathQuery, searchScope, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        possibleCandidateCount = xPathResults.snapshotLength;
        for (var i = 0; i < possibleCandidateCount; i++) {
            var element = xPathResults.snapshotItem(i);
            if (shouldIgnoreElementBySelfOrAncestorTagName(element))
                continue;
            var candidate = CandidateElement.extraArticleCandidateIfElementIsViable(element, this.article, this.contentDocument, false);
            if (candidate)
                candidateElements.push(candidate);
        }
        return candidateElements;
    },
    isGeneratedBy: function isGeneratedBy(pattern) {
        var generatorMeta = this.contentDocument.head ? this.contentDocument.head.querySelector("meta[name=generator]") : null;
        if (!generatorMeta)
            return false;
        var generator = generatorMeta.content;
        if (!generator)
            return false;
        return pattern.test(generator);
    },
    isMediaWikiPage: function isMediaWikiPage() {
        return this.isGeneratedBy(/^MediaWiki /);
    },
    isWordPressSite: function isWordPressSite() {
        return this.isGeneratedBy(/^WordPress/);
    },
    nextPageURLString: function nextPageURLString() {
        if (!this.article)
            return null;
        if (this.isMediaWikiPage())
            return null;
        var bestLink;
        var bestLinkScore = 0;
        var searchScope = this.article.element;
        if (searchScope.parentNode && getComputedStyle(searchScope).display === "inline")
            searchScope = searchScope.parentNode;
        var possibleSearchScope = searchScope;
        var minimumBottomOffset = cachedElementBoundingRect(searchScope).bottom + LinkMaxVerticalDistanceFromArticle;
        while (isElementNode(possibleSearchScope) && cachedElementBoundingRect(possibleSearchScope).bottom <= minimumBottomOffset)
            possibleSearchScope = possibleSearchScope.parentNode;
        if (possibleSearchScope !== searchScope && (possibleSearchScope === this.contentDocument || isElementNode(possibleSearchScope)))
            searchScope = possibleSearchScope;
        var anchorElements = this.contentDocument.evaluate(LinkCandidateXPathQuery, searchScope, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var numberOfLinks = anchorElements.snapshotLength;
        if (this.pageNumber <= 2 && !this.prefixWithDateForNextPageURL) {
            var articleURL = this.contentDocument.location.pathname;
            var dateMatch = articleURL.match(LinkDateRegex);
            if (dateMatch) {
                dateMatch = dateMatch[0];
                this.prefixWithDateForNextPageURL = articleURL.substring(0, articleURL.indexOf(dateMatch) + dateMatch.length);
            }
        }
        for (var i = 0; i < numberOfLinks; i++) {
            var link = anchorElements.snapshotItem(i);
            var score = this.scoreNextPageLinkCandidate(link);
            if (score > bestLinkScore) {
                bestLink = link;
                bestLinkScore = score;
            }
        }
        return bestLink ? bestLink.href : null;
    },
    scoreNextPageLinkCandidate: function scoreNextPageLinkCandidate(link) {
        function isNextOrdinal(referenceString, linkString, linkText, pageNumber) {
            if (linkString.substring(0, referenceString.length) === referenceString) {
                linkString = linkString.substring(referenceString.length);
                referenceString = "";
            }
            var linkOrdinal = linkString.lastInteger();
            if (isNaN(linkOrdinal))
                return false;
            var referenceOrdinal = referenceString ? referenceString.lastInteger() : NaN;
            if (isNaN(referenceOrdinal) || referenceOrdinal >= MaximumExactIntegralValue)
                referenceOrdinal = pageNumber;
            if (linkOrdinal == referenceOrdinal)
                return linkText.lastInteger() === referenceOrdinal + 1;
            return linkOrdinal === referenceOrdinal + 1;
        }

        function parametersFromSearch(search) {
            var map = {};
            var parameters = search.substring(1).split("&");
            for (var i = 0; i < parameters.length; i++) {
                var parameter = parameters[i];
                var equalsIndex = parameter.indexOf("=");
                if (equalsIndex === -1)
                    map[parameter] = null;
                else
                    map[parameter.substring(0, equalsIndex)] = parameter.substring(equalsIndex + 1);
            }
            return map;
        }
        var referenceLocation = this.contentDocument.location;
        if (link.host !== referenceLocation.host)
            return 0;
        if (link.pathname === referenceLocation.pathname && link.search === referenceLocation.search)
            return 0;
        if (link.toString().indexOf("#") != -1)
            return 0;
        if (!isElementVisible(link))
            return 0;
        var linkBoundingRect = cachedElementBoundingRect(link);
        var articleBoundingRect = cachedElementBoundingRect(this.article.element);
        var verticalDistanceFromArticle = Math.max(0, Math.max(articleBoundingRect.top - (linkBoundingRect.top + linkBoundingRect.height), linkBoundingRect.top - (articleBoundingRect.top + articleBoundingRect.height)));
        if (linkBoundingRect.top < articleBoundingRect.top)
            return 0;
        if (verticalDistanceFromArticle > LinkMaxVerticalDistanceFromArticle)
            return 0;
        var horizontalDistanceFromArticle = Math.max(0, Math.max(articleBoundingRect.left - (linkBoundingRect.left + linkBoundingRect.width), linkBoundingRect.left - (articleBoundingRect.left + articleBoundingRect.width)));
        if (horizontalDistanceFromArticle > 0)
            return 0;
        var referenceLocationPath = referenceLocation.pathname;
        var linkPath = link.pathname;
        if (this.prefixWithDateForNextPageURL) {
            if (link.pathname.indexOf(this.prefixWithDateForNextPageURL) == -1)
                return 0;
            referenceLocationPath = referenceLocationPath.substring(this.prefixWithDateForNextPageURL.length);
            linkPath = linkPath.substring(this.prefixWithDateForNextPageURL.length);
        }
        var linkPathComponents = linkPath.substring(1).split("/");
        if (!linkPathComponents[linkPathComponents.length - 1])
            linkPathComponents.pop();
        var referencePathComponents = referenceLocationPath.substring(1).split("/");
        var linkEndsWithSlash = false;
        if (!referencePathComponents[referencePathComponents.length - 1]) {
            linkEndsWithSlash = true;
            referencePathComponents.pop();
        }
        if (linkPathComponents.length < referencePathComponents.length)
            return 0;
        var mismatchCount = 0;
        var nextOrdinalMatchValue = 0;
        var linkText = link.textContent;
        for (var i = 0; i < linkPathComponents.length; i++) {
            var linkComponent = linkPathComponents[i];
            var referenceComponent = i < referencePathComponents.length ? referencePathComponents[i] : "";
            if (referenceComponent !== linkComponent) {
                if (i < referencePathComponents.length - 2)
                    return 0;
                if (linkComponent.length >= referenceComponent.length) {
                    var commonSuffixLength = 0;
                    while (linkComponent[linkComponent.length - 1 - commonSuffixLength] === referenceComponent[referenceComponent.length - 1 - commonSuffixLength])
                        commonSuffixLength++;
                    if (commonSuffixLength) {
                        linkComponent = linkComponent.substring(0, linkComponent.length - commonSuffixLength);
                        referenceComponent = referenceComponent.substring(0, referenceComponent.length - commonSuffixLength);
                    }
                }
                if (isNextOrdinal(referenceComponent, linkComponent, linkText, this.pageNumber))
                    nextOrdinalMatchValue = Math.pow(LinkNextOrdinalValueBase, (i - linkPathComponents.length + 1));
                else
                    mismatchCount++;
            }
            if (mismatchCount > 1)
                return 0;
        }
        var didEarnURLSemanticBonus = false;
        if (link.search) {
            linkParameters = parametersFromSearch(link.search);
            referenceParameters = parametersFromSearch(referenceLocation.search);
            for (var key in linkParameters) {
                var linkValue = linkParameters[key];
                var referenceValue = key in referenceParameters ? referenceParameters[key] : null;
                if (referenceValue !== linkValue) {
                    if (referenceValue === null)
                        referenceValue = "";
                    if (linkValue === null)
                        linkValue = "";
                    if (linkValue.length < referenceValue.length)
                        mismatchCount++;
                    else if (isNextOrdinal(referenceValue, linkValue, linkText, this.pageNumber)) {
                        if (LinkURLSearchParameterKeyMatchRegex.test(key)) {
                            if (referenceLocationPath.toLowerCase() === linkPath.toLowerCase()) {
                                if (this.isWordPressSite() && linkEndsWithSlash)
                                    return 0;
                                didEarnURLSemanticBonus = true;
                            } else
                                return 0;
                        } else if (LinkURLBadSearchParameterKeyMatchRegex.test(key)) {
                            mismatchCount++;
                            continue;
                        }
                        nextOrdinalMatchValue = Math.max(nextOrdinalMatchValue, 1 / LinkNextOrdinalValueBase);
                    } else
                        mismatchCount++;
                }
            }
        }
        if (!nextOrdinalMatchValue)
            return 0;
        if (LinkURLPageSlashNumberMatchRegex.test(link.href) || LinkURLSlashDigitEndMatchRegex.test(link.href))
            didEarnURLSemanticBonus = true;
        if (!didEarnURLSemanticBonus && linkPathComponents.length == referencePathComponents.length && stringSimilarity(referenceLocationPath, linkPath) < LinkMinimumURLSimilarityRatio)
            return 0;
        if (LinkURLArchiveSlashDigitEndMatchRegex.test(link))
            return 0;
        var score = LinkMatchWeight * (Math.pow(LinkMismatchValueBase, -mismatchCount) + nextOrdinalMatchValue) + LinkVerticalDistanceFromArticleWeight * verticalDistanceFromArticle / LinkMaxVerticalDistanceFromArticle;
        if (didEarnURLSemanticBonus)
            score += LinkURLSemanticMatchBonus;
        if (link.parentNode.tagName === "LI")
            score += LinkListItemBonus;
        var linkText = link.innerText;
        if (LinkNextMatchRegEx.test(linkText))
            score += LinkNextMatchBonus;
        if (LinkPageMatchRegEx.test(linkText))
            score += LinkPageMatchBonus;
        if (LinkContinueMatchRegEx.test(linkText))
            score += LinkContinueMatchBonus;
        return score;
    },
    articleTextContent: function articleTextContent() {
        return this._articleTextContent;
    },
    readingListItemInformation: function readingListItemInformation() {
        const ReaderTitleMaxLength = 140;
        const ReaderPreviewTextMaxLength = 140;
        var title;
        var previewText;
        var isReaderAvailable = false;
        if (this.adoptableArticle()) {
            title = this.articleTitle();
            previewText = this.articleTextContent();
            isReaderAvailable = true;
        } else {
            title = this.contentDocument.title;
            previewText = this.contentDocument.body.innerText;
        }
        if (!title)
            title = this.contentDocument.location.href;
        title = title.trim().substring(0, ReaderTitleMaxLength);
        if (!previewText)
            previewText = "";
        previewText = previewText.trim().substring(0, ReaderPreviewTextMaxLength).replace(/[\s]+/g, ' ');
        var info = {
            "title": title,
            "previewText": previewText,
            "isReaderAvailable": isReaderAvailable
        };
        return info;
    }
}
var ArticleFinderJS = new ArticleFinder(document);