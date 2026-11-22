import type { AgentName, ChatCommand } from '../constants/chat.constants';

export const IntentKind = {
  COMMAND: 'command',
  UNKNOWN_COMMAND: 'unknown_command',
  MENTION: 'mention',
  HAPPY: 'happy',
  FREE_FORM: 'free_form',
} as const;
export type IntentKind = (typeof IntentKind)[keyof typeof IntentKind];

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

export const HappyTargetKind = {
  LINK: 'link',
  NUMBER: 'number',
  PICK: 'pick',
  UNCLEAR: 'unclear',
} as const;

export type HappyTarget =
  | { kind: typeof HappyTargetKind.LINK; pullRequest: PullRequestRef }
  | { kind: typeof HappyTargetKind.NUMBER; number: number }
  | { kind: typeof HappyTargetKind.PICK }
  | { kind: typeof HappyTargetKind.UNCLEAR };

export type Intent =
  | { kind: typeof IntentKind.COMMAND; command: ChatCommand; args: string }
  | { kind: typeof IntentKind.UNKNOWN_COMMAND }
  | { kind: typeof IntentKind.MENTION; agent: AgentName; text: string }
  | { kind: typeof IntentKind.HAPPY; target: HappyTarget }
  | { kind: typeof IntentKind.FREE_FORM; text: string };
