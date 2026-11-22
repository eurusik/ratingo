import { HappyTargetKind, type HappyTarget } from '../entities/intent';

import { matchPullRequestLink } from './pattern-router.policy';

const MAX_WORDS_AROUND_NUMBER = 3;
const WORD = "[\\p{L}'’ʼ]+";
const PULL_NUMBER = new RegExp(
  `^(?:${WORD}\\s+){0,${MAX_WORDS_AROUND_NUMBER}}(?:#|№)?(\\d{1,9})(?:\\s+${WORD}){0,${MAX_WORDS_AROUND_NUMBER}}\\s*[?.!]*$`,
  'u',
);

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
