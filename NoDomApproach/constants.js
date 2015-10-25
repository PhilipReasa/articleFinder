/*
 * CONSTANTS
 */
const ReaderMinimumAdvantage = 15;
const ArticleMinimumScoreDensity = 4.25;
const CandidateMinimumWidth = 280;
const CandidateMinimumHeight = 295;
const CandidateMinimumArea = 170000;
const CandidateMaximumTop = 1300;
const CandidateMinimumWidthPortionForIndicatorElements = 0.5;
const CandidateMinumumListItemLineCount = 4;
const CandidateTagNamesToIgnore = {
    "A": 1,
    "BODY": 1,
    "EMBED": 1,
    "FORM": 1,
    "HTML": 1,
    "IFRAME": 1,
    "OBJECT": 1,
    "OPTION": 1,
    "SCRIPT": 1,
    "STYLE": 1,
    "svg": 1
};
const CandidateTagNamesToIgnoreDescendantsOf = {
    "DD": 1,
    "DT": 1,
    "LI": 1,
    "OL": 1,
    "UL": 1
};
const PrependedArticleCandidateMinimumHeight = 50;
const AppendedArticleCandidateMinimumHeight = 200;
const AppendedArticleCandidateMaximumVerticalDistanceFromArticle = 150;
const StylisticClassNames = {
    "justfy": 1,
    "justify": 1,
    "left": 1,
    "right": 1,
    "small": 1
};
const CommentRegEx = /comment|meta|footer|footnote/;
const CommentMatchPenalty = 0.5;
const ArticleRegEx = /(?:(?:^|\\s)(?:post|hentry|entry[-]?(?:content|text|body)?|article[-]?(?:content|text|body)?)(?:\\s|$))/;
const ArticleMatchBonus = 0.5;
const DensityExcludedElementSelector = "#disqus_thread, #comments, .userComments";
const AttributesToRemoveRegEx = /^on|^id$|^class$|^style$/;
const PositiveRegEx = /article|body|content|entry|hentry|page|pagination|post|text/i;
const NegativeRegEx = /breadcrumb|combx|comment|contact|disqus|foot|footer|footnote|link|media|meta|mod-conversations|promo|related|scroll|share|shoutbox|sidebar|social|sponsor|tags|toolbox|widget/i;
const MinimumAverageDistanceBetweenHRElements = 400;
const MinimumAverageDistanceBetweenHeaderElements = 400;
const PortionOfCandidateHeightToIgnoreForHeaderCheck = 0.1;
const ScoreMultiplierForChineseJapaneseKorean = 3;
const MinimumContentImageHeight = 200;
const MinimumContentImageWidthToArticleWidthRatio = 0.5;
const MaximumContentImageAreaToArticleAreaRatio = 0.2;
const LinkContinueMatchRegEx = /continue/gi;
const LinkNextMatchRegEx = /next/gi;
const LinkPageMatchRegEx = /page/gi;
const LinkListItemBonus = 5;
const LinkPageMatchBonus = 10;
const LinkNextMatchBonus = 15;
const LinkContinueMatchBonus = 15;
const LinkNextOrdinalValueBase = 3;
const LinkMismatchValueBase = 2;
const LinkMatchWeight = 200;
const LinkMaxVerticalDistanceFromArticle = 200;
const LinkVerticalDistanceFromArticleWeight = 150;
const LinkCandidateXPathQuery = "descendant-or-self::*[(not(@id) or (@id!='disqus_thread' and @id!='comments')) and (not(@class) or @class!='userComments')]/a";
const LinkDateRegex = /\D(?:\d\d(?:\d\d)?[\-\/](?:10|11|12|0?[1-9])[\-\/](?:30|31|[12][0-9]|0?[1-9])|\d\d(?:\d\d)?\/(?:10|11|12|0[1-9])|(?:10|11|12|0?[1-9])\-(?:30|31|[12][0-9]|0?[1-9])\-\d\d(?:\d\d)?|(?:30|31|[12][0-9]|0?[1-9])\-(?:10|11|12|0?[1-9])\-\d\d(?:\d\d)?)\D/;
const LinkURLSearchParameterKeyMatchRegex = /(page|^p$|^pg$)/i;
const LinkURLPageSlashNumberMatchRegex = /\/.*page.*\/\d+/i;
const LinkURLSlashDigitEndMatchRegex = /\/\d+\/?$/;
const LinkURLArchiveSlashDigitEndMatchRegex = /archives?\/\d+\/?$/;
const LinkURLBadSearchParameterKeyMatchRegex = /feed/;
const LinkURLSemanticMatchBonus = 100;
const LinkMinimumURLSimilarityRatio = 0.75;
const HeaderMinimumDistanceFromArticleTop = 200;
const HeaderLevenshteinDistanceToLengthRatio = 0.75;
const FloatMinimumHeight = 130;
const ImageSizeTiny = 32;
const ImageWidthToParentWidthRatio = .5;
const AnchorImageMinimumWidth = 100;
const AnchorImageMinimumHeight = 100;
const BaseFontSize = 16;
const BaseLineHeightRatio = 1.125;
const MaximumExactIntegralValue = 9007199254740992;
const TitleCandidateDepthScoreMultiplier = 0.1;
const DocumentPositionPreceding = 0x02;
const DocumentPositionContainedBy = 0x10;