import { COMMAND_VERBS, SLASH_COMMAND_PREFIX } from '../constants/webhook.constants';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LEADING_BLANK_LINES = /^(?:[ \t]*\r?\n)+/;

const commandPattern = (mentionHandle: string): RegExp =>
  new RegExp(
    `^ {0,3}(?:@${escapeRegExp(mentionHandle)}|${escapeRegExp(SLASH_COMMAND_PREFIX)})[ \\t]+(?:${COMMAND_VERBS.join('|')})(?![\\w-])`,
    'i',
  );

export const isReviewCommand = (body: string, mentionHandle: string): boolean =>
  commandPattern(mentionHandle).test(body.replace(LEADING_BLANK_LINES, ''));
