import type { Intent } from '../entities/intent';
import { IntentKind } from '../entities/intent';
import { AgentName } from '../constants/chat.constants';

import { parseCommand } from './command-parser.policy';
import { matchReviewRequest, parseHappyTarget } from './happy-target.policy';
import { parseMention } from './mention-parser.policy';
import { matchPullRequestLink } from './pattern-router.policy';

export const routeMessage = (text: string): Intent => {
  const command = parseCommand(text);
  if (command !== null) {
    return command.known
      ? { kind: IntentKind.COMMAND, command: command.command, args: command.args }
      : { kind: IntentKind.UNKNOWN_COMMAND };
  }
  const mention = parseMention(text);
  if (mention?.agent === AgentName.HAPPY) {
    return { kind: IntentKind.HAPPY, target: parseHappyTarget(mention.text) };
  }
  if (mention !== null) {
    return { kind: IntentKind.MENTION, agent: mention.agent, text: mention.text };
  }
  if (matchPullRequestLink(text) !== null) {
    return { kind: IntentKind.HAPPY, target: parseHappyTarget(text) };
  }
  const requested = matchReviewRequest(text);
  if (requested !== null) {
    return { kind: IntentKind.HAPPY, target: requested };
  }
  return { kind: IntentKind.FREE_FORM, text: text.trim() };
};
