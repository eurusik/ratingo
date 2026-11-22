import type { PullRequestRef } from '../entities/intent';

const PULL_REQUEST_LINK = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d{1,9})(?!\d)/i;

export const matchPullRequestLink = (text: string): PullRequestRef | null => {
  const match = PULL_REQUEST_LINK.exec(text);
  if (match === null) return null;
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
};
