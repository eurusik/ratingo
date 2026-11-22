import type { AgentName, ChatCommand } from '../constants/chat.constants';

export const IntentKind = {
  COMMAND: 'command',
  UNKNOWN_COMMAND: 'unknown_command',
  MENTION: 'mention',
  PATTERN: 'pattern',
  FREE_FORM: 'free_form',
} as const;
export type IntentKind = (typeof IntentKind)[keyof typeof IntentKind];

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

export type Intent =
  | { kind: typeof IntentKind.COMMAND; command: ChatCommand; args: string }
  | { kind: typeof IntentKind.UNKNOWN_COMMAND }
  | { kind: typeof IntentKind.MENTION; agent: AgentName; text: string }
  | { kind: typeof IntentKind.PATTERN; pullRequest: PullRequestRef }
  | { kind: typeof IntentKind.FREE_FORM; text: string };
