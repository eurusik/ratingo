import { HAPPY_PICK_LIST_SHOWN, HAPPY_PICK_TITLE_MAX_CHARS } from '../constants/happy.constants';
import {
  HAPPY_CHOOSE_PULL_REQUEST_REPLY,
  HAPPY_MORE_PULL_REQUESTS_NOTE,
} from '../constants/chat-replies.constants';
import type { HappyOpenPullRequest } from '../entities/happy';

import { clip, stripLinks } from './answer-sanitizer.policy';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const JUST_NOW_MINUTES = 1;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const pullRequestTitle = (title: string): string =>
  escapeHtml(clip(stripLinks(title).replace(/\s+/g, ' ').trim(), HAPPY_PICK_TITLE_MAX_CHARS));

export const formatAgo = (nowMs: number, thenMs: number): string => {
  const minutes = Math.max(0, Math.floor((nowMs - thenMs) / MS_PER_MINUTE));
  if (!Number.isFinite(minutes) || minutes < JUST_NOW_MINUTES) return 'щойно';
  if (minutes < MINUTES_PER_HOUR) return `${minutes} хв тому`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return hours < HOURS_PER_DAY
    ? `${hours} год тому`
    : `${Math.floor(hours / HOURS_PER_DAY)} дн тому`;
};

const line = (pull: HappyOpenPullRequest, nowMs: number): string =>
  `• №${pull.number} «${pullRequestTitle(pull.title)}» (${escapeHtml(clip(pull.author, 40))}, ${formatAgo(nowMs, pull.updatedAtMs)})`;

export const renderPullRequestChoice = (
  pulls: readonly HappyOpenPullRequest[],
  nowMs: number,
): string =>
  [
    HAPPY_CHOOSE_PULL_REQUEST_REPLY,
    ...pulls.slice(0, HAPPY_PICK_LIST_SHOWN).map((pull) => line(pull, nowMs)),
    ...(pulls.length > HAPPY_PICK_LIST_SHOWN ? [HAPPY_MORE_PULL_REQUESTS_NOTE] : []),
  ].join('\n');
