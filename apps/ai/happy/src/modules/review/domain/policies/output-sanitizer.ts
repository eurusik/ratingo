const CODE_SEGMENT = /(```[\s\S]*?```|`[^`\n]*`)/;
const IMAGE_MARKDOWN = /!\[[^\]]*\]\([^)]*\)/g;
const IMAGE_REFERENCE = /!\[[^\]]*\]\[[^\]]*\]/g;
const HTML_TAG_WITH_URL = /<\/?(?:img|a|picture|source|iframe|video|audio)\b[^>]*>/gi;
const LINK_MARKDOWN = /\[([^\]]*)\]\([^)]*\)/g;
const AUTOLINK = /<(?:https?|ftp|mailto):[^>]*>/gi;
const BARE_URL = /(?:https?|ftp):\/\/[^\s)>\]]+/gi;
const WWW_URL = /\bwww\.[^\s)>\]]+/gi;
const MENTION = /(^|[^\w`])@+(?=\w)/g;
const IMAGE_OPENER = /!(?=\[)/g;
const MAX_PASSES = 5;
const LINK_REMOVED = '[link removed]';

const sanitizeOnce = (text: string): string =>
  text
    .replace(IMAGE_MARKDOWN, '')
    .replace(IMAGE_REFERENCE, '')
    .replace(HTML_TAG_WITH_URL, '')
    .replace(LINK_MARKDOWN, '$1')
    .replace(AUTOLINK, LINK_REMOVED)
    .replace(BARE_URL, LINK_REMOVED)
    .replace(WWW_URL, LINK_REMOVED)
    .replace(MENTION, '$1')
    .replace(IMAGE_OPENER, '');

const sanitizeProse = (text: string): string => {
  let current = text;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = sanitizeOnce(current);
    if (next === current) return next;
    current = next;
  }
  return current;
};

export const sanitizeModelText = (text: string): string =>
  text
    .split(CODE_SEGMENT)
    .map((segment, index) => (index % 2 === 1 ? segment : sanitizeProse(segment)))
    .join('');
