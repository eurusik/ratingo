import type { Intent } from '../entities/intent';
import { IntentKind } from '../entities/intent';

import { parseCommand } from './command-parser.policy';
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
  if (mention !== null) {
    return { kind: IntentKind.MENTION, agent: mention.agent, text: mention.text };
  }
  const pullRequest = matchPullRequestLink(text);
  if (pullRequest !== null) {
    return { kind: IntentKind.PATTERN, pullRequest };
  }
  return { kind: IntentKind.FREE_FORM, text: text.trim() };
};
