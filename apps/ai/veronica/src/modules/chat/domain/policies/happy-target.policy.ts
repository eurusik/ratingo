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
const REVIEW_VERB = `(?:глянь|переглянь|подивись|перевір|рев${APOSTROPHE}?ю|review|check)`;
const PR_TOKEN = `${NOT_LETTER_BEFORE}(?:pull\\s*request|пул[\\s-]?реквест|pr|пр)${NOT_LETTER_AFTER}`;
const NUMBER_MARK = '(?:#|№)';
const MAX_LEADING_WORDS = 2;
const REVIEW_REQUEST = new RegExp(
  `^(?:${WORD}\\s+){0,${MAX_LEADING_WORDS}}${NOT_LETTER_BEFORE}${REVIEW_VERB}${NOT_LETTER_AFTER}\\s+(?:(?:на|у|в)\\s+)?` +
    `(?:${PR_TOKEN}\\s*${NUMBER_MARK}?\\s*(\\d{1,9})|${NUMBER_MARK}\\s*(\\d{1,9})|(\\d{1,9})\\s+${PR_TOKEN})` +
    `(?:\\s+(?:будь\\s+ласка|плз))?\\s*[?.!]*$`,
  'iu',
);

export const matchReviewRequest = (text: string): number | null => {
  const groups = REVIEW_REQUEST.exec(text.trim());
  const digits = groups?.[1] ?? groups?.[2] ?? groups?.[3];
  const number = digits === undefined ? 0 : Number(digits);
  return number > 0 ? number : null;
};

export const parseHappyTarget = (text: string): HappyTarget => {
  const pullRequest = matchPullRequestLink(text);
  if (pullRequest !== null) return { kind: HappyTargetKind.LINK, pullRequest };
  const digits = PULL_NUMBER.exec(text.trim())?.[1];
  const number = digits === undefined ? 0 : Number(digits);
  return number > 0 ? { kind: HappyTargetKind.NUMBER, number } : { kind: HappyTargetKind.UNCLEAR };
};

export const isSameRepository = (
  pullRequest: { owner: string; repo: string },
  repository: string,
): boolean => `${pullRequest.owner}/${pullRequest.repo}`.toLowerCase() === repository.toLowerCase();
