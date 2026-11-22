import type { HappyTarget, Intent } from '../entities/intent';
import { IntentKind } from '../entities/intent';
import { AgentName } from '../constants/chat.constants';
import { HappyReviewMode } from '../entities/happy';

import { parseCommand } from './command-parser.policy';
import { matchReviewRequest, parseHappyTarget } from './happy-target.policy';
import { parseMention } from './mention-parser.policy';
import { parseReviewMode } from './happy-review-mode.policy';
import { matchPullRequestLink } from './pattern-router.policy';

const happyIntent = (target: HappyTarget, mode: HappyReviewMode): Intent =>
  mode === HappyReviewMode.FULL
    ? { kind: IntentKind.HAPPY, target, mode }
    : { kind: IntentKind.HAPPY, target };

export const routeMessage = (text: string): Intent => {
  const command = parseCommand(text);
  if (command !== null) {
    return command.known
      ? { kind: IntentKind.COMMAND, command: command.command, args: command.args }
      : { kind: IntentKind.UNKNOWN_COMMAND };
  }
  const mention = parseMention(text);
  if (mention?.agent === AgentName.HAPPY) {
    const request = parseReviewMode(mention.text);
    return happyIntent(parseHappyTarget(request.text), request.mode);
  }
  if (mention !== null) {
    return { kind: IntentKind.MENTION, agent: mention.agent, text: mention.text };
  }
  const request = parseReviewMode(text);
  if (matchPullRequestLink(request.text) !== null) {
    return happyIntent(parseHappyTarget(request.text), request.mode);
  }
  const requested = matchReviewRequest(request.text, request.marked);
  if (requested !== null) {
    return happyIntent(requested, request.mode);
  }
  return { kind: IntentKind.FREE_FORM, text: text.trim() };
};
