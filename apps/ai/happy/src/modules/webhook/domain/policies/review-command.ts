import { RequestedMode } from '../../../review/public';
import { COMMAND_VERBS, FULL_MODIFIER, SLASH_COMMAND_PREFIX } from '../constants/webhook.constants';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LEADING_BLANK_LINES = /^(?:[ \t]*\r?\n)+/;

const commandPattern = (mentionHandle: string): RegExp =>
  new RegExp(
    `^ {0,3}(?:@${escapeRegExp(mentionHandle)}|${escapeRegExp(SLASH_COMMAND_PREFIX)})[ \\t]+(?:${COMMAND_VERBS.join('|')})(?:[ \\t]+(${FULL_MODIFIER}))?(?![\\w-])`,
    'i',
  );

export const parseReviewCommand = (
  body: string,
  mentionHandle: string,
): { mode: RequestedMode } | null => {
  const match = commandPattern(mentionHandle).exec(body.replace(LEADING_BLANK_LINES, ''));
  if (match === null) return null;
  return { mode: match[1] === undefined ? RequestedMode.AUTO : RequestedMode.FULL };
};
