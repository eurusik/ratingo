import { HappyTargetKind, type HappyTarget } from '../entities/intent';

import { matchPullRequestLink } from './pattern-router.policy';

const MAX_WORDS_AROUND_NUMBER = 3;
const WORD = "[\\p{L}'’ʼ]+";
const PULL_NUMBER = new RegExp(
  `^(?:${WORD}\\s+){0,${MAX_WORDS_AROUND_NUMBER}}(?:#|№)?(\\d{1,9})(?:\\s+${WORD}){0,${MAX_WORDS_AROUND_NUMBER}}\\s*[?.!]*$`,
  'u',
);

const APOSTROPHE = "['’ʼ]";
const NOT_LETTER_BEFORE = '(?<![\\p{L}])';
const NOT_LETTER_AFTER = '(?![\\p{L}])';
const REVIEW_NOUN = `рев(?:${APOSTROPHE}|ь)?ю`;
const SIMPLE_VERB = `(?:глянь|переглянь|подивись|перевір|${REVIEW_NOUN}|review|check)`;
const WHAT_ABOUT = '(?:глянь\\s+)?(?:шо|що)\\s+там\\s+по';
const VERB = `(?:${WHAT_ABOUT}|${SIMPLE_VERB})${NOT_LETTER_AFTER}`;
const STANDALONE_REQUEST = `(?:зроби\\s+(?:${REVIEW_NOUN}|review)|про${REVIEW_NOUN}й)${NOT_LETTER_AFTER}`;
const PR_TOKEN = `${NOT_LETTER_BEFORE}(?:pull\\s*request|merge\\s*request|пул[\\s-]?реквест\\p{L}*|пулл?\\p{L}{0,2}|мр\\p{L}{0,2}|пр|pr|mr)${NOT_LETTER_AFTER}`;
const NUMBER_MARK = '(?:#|№)';
const PREPOSITION = '(?:(?:на|у|в|по)\\s+)?';
const POLITE_TAIL = '(?:\\s*,?\\s+(?:будь\\s+ласка|плз))?\\s*[?.!]*$';
const MAX_LEADING_WORDS = 2;
const LEADING = `^(?:${WORD}\\s+){0,${MAX_LEADING_WORDS}}${NOT_LETTER_BEFORE}`;
const NUMBERED_REQUEST = new RegExp(
  `${LEADING}${VERB}\\s+${PREPOSITION}` +
    `(?:${PR_TOKEN}\\s*${NUMBER_MARK}?\\s*(\\d{1,9})|${NUMBER_MARK}\\s*(\\d{1,9})|(\\d{1,9})\\s+${PR_TOKEN})${POLITE_TAIL}`,
  'iu',
);
const UNNUMBERED_REQUEST = new RegExp(
  `${LEADING}(?:${STANDALONE_REQUEST}|${VERB}\\s+${PREPOSITION}${PR_TOKEN})${POLITE_TAIL}`,
  'iu',
);

export const matchReviewRequest = (text: string): HappyTarget | null => {
  const trimmed = text.trim();
  const groups = NUMBERED_REQUEST.exec(trimmed);
  if (groups !== null) {
    const number = Number(groups[1] ?? groups[2] ?? groups[3]);
    return number > 0 ? { kind: HappyTargetKind.NUMBER, number } : null;
  }
  return UNNUMBERED_REQUEST.test(trimmed) ? { kind: HappyTargetKind.PICK } : null;
};

export const parseHappyTarget = (text: string): HappyTarget => {
  const pullRequest = matchPullRequestLink(text);
  if (pullRequest !== null) return { kind: HappyTargetKind.LINK, pullRequest };
  const digits = PULL_NUMBER.exec(text.trim())?.[1];
  const number = digits === undefined ? 0 : Number(digits);
  if (number > 0) return { kind: HappyTargetKind.NUMBER, number };
  return matchReviewRequest(text) ?? { kind: HappyTargetKind.UNCLEAR };
};

export const isSameRepository = (
  pullRequest: { owner: string; repo: string },
  repository: string,
): boolean => `${pullRequest.owner}/${pullRequest.repo}`.toLowerCase() === repository.toLowerCase();
