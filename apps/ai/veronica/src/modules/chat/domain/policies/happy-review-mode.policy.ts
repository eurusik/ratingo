import { HappyReviewMode } from '../entities/happy';

const NOT_LETTER_BEFORE = '(?<![\\p{L}])';
const NOT_LETTER_AFTER = '(?![\\p{L}])';
const FULL_MARKER = new RegExp(
  `${NOT_LETTER_BEFORE}(?:повн(?:істю|е|ого|ий|ому|а|у)|full)${NOT_LETTER_AFTER}`,
  'giu',
);
const NEW_COMMITS_MARKER = new RegExp(
  `${NOT_LETTER_BEFORE}нов(?:і|их|им|ими)\\s+коміт\\p{L}*${NOT_LETTER_AFTER}`,
  'giu',
);
const WHITESPACE = /\s+/g;

export interface ParsedReviewMode {
  text: string;
  mode: HappyReviewMode;
  marked: boolean;
}

export const parseReviewMode = (text: string): ParsedReviewMode => {
  const isFull = new RegExp(FULL_MARKER.source, 'iu').test(text);
  const stripped = text
    .replace(FULL_MARKER, ' ')
    .replace(NEW_COMMITS_MARKER, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
  const marked = stripped !== text.replace(WHITESPACE, ' ').trim();
  return {
    text: marked ? stripped : text,
    mode: isFull ? HappyReviewMode.FULL : HappyReviewMode.AUTO,
    marked,
  };
};
