import {
  TELEGRAM_ALLOWED_TAGS,
  TELEGRAM_BLOCKQUOTE_EXPANDABLE,
  TELEGRAM_MESSAGE_LIMIT,
  TRUNCATION_MARK,
} from '../constants/telegram.constants';

const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^<>]*)>/g;
const LONE_AMPERSAND = /&(?!(?:amp|lt|gt|quot|#\d+);)/g;
const PARTIAL_ENTITY_AT_END = /&[#a-zA-Z0-9]*$/;
const HIGH_SURROGATE_AT_END = /[\uD800-\uDBFF]$/;

const escapeText = (text: string): string =>
  text.replace(LONE_AMPERSAND, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

const codeLinkPattern = (repository: string): RegExp =>
  new RegExp(
    `^href="https://github\\.com/${repository.replace(REGEX_SPECIALS, '\\$&')}/blob/[0-9a-f]{40}/[A-Za-z0-9._~%@+/-]+#L\\d+(?:-L\\d+)?"$`,
  );

const isAllowedOpening = (name: string, attributes: string, codeLink: RegExp | null): boolean => {
  const trimmed = attributes.trim();
  return (
    trimmed === '' ||
    (name === 'blockquote' && trimmed === TELEGRAM_BLOCKQUOTE_EXPANDABLE) ||
    (name === 'a' && codeLink !== null && codeLink.test(trimmed))
  );
};

const openingTag = (name: string, attributes: string): string =>
  attributes.trim() === '' ? `<${name}>` : `<${name} ${attributes.trim()}>`;

const balance = (html: string, codeLink: RegExp | null): string => {
  const open: string[] = [];
  let output = '';
  let cursor = 0;
  for (const match of html.matchAll(TAG_PATTERN)) {
    const [raw, slash, rawName, attributes] = match;
    const name = rawName.toLowerCase();
    output += escapeText(html.slice(cursor, match.index));
    cursor = match.index + raw.length;
    if (!TELEGRAM_ALLOWED_TAGS.includes(name)) continue;
    if (slash === '') {
      if (!isAllowedOpening(name, attributes, codeLink)) continue;
      open.push(name);
      output += openingTag(name, attributes);
    } else if (open[open.length - 1] === name) {
      open.pop();
      output += `</${name}>`;
    }
  }
  output += escapeText(html.slice(cursor));
  return (
    output +
    open
      .reverse()
      .map((name) => `</${name}>`)
      .join('')
  );
};

const stripTags = (html: string): string => html.replace(TAG_PATTERN, '');

const truncatePlain = (text: string, limit: number): string => {
  const room = limit - TRUNCATION_MARK.length;
  const clipped = text
    .slice(0, room)
    .replace(HIGH_SURROGATE_AT_END, '')
    .replace(PARTIAL_ENTITY_AT_END, '');
  return `${clipped}${TRUNCATION_MARK}`;
};

export interface SanitizeOptions {
  limit?: number;
  codeRepository?: string;
}

export const sanitizeTelegramHtml = (html: string, options: SanitizeOptions = {}): string => {
  const limit = options.limit ?? TELEGRAM_MESSAGE_LIMIT;
  const codeLink =
    options.codeRepository === undefined ? null : codeLinkPattern(options.codeRepository);
  const balanced = balance(html, codeLink);
  return balanced.length <= limit ? balanced : truncatePlain(stripTags(balanced), limit);
};
