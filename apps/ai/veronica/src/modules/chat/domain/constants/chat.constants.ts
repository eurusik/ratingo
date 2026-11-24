export const ChatCommand = {
  HELP: 'help',
  DIGEST: 'digest',
  STATUS: 'status',
  QUEUES: 'queues',
  SITE: 'site',
  LAST: 'last',
} as const;
export type ChatCommand = (typeof ChatCommand)[keyof typeof ChatCommand];

export const COMMAND_DESCRIPTIONS: Readonly<Record<ChatCommand, string>> = {
  [ChatCommand.HELP]: 'що я вмію',
  [ChatCommand.DIGEST]: 'звіт за сьогодні просто зараз',
  [ChatCommand.STATUS]: 'стан одним екраном',
  [ChatCommand.QUEUES]: 'фонові завдання детально',
  [ChatCommand.SITE]: 'сайт детально',
  [ChatCommand.LAST]: 'три останні відповіді: питання, результат, ціна',
};

export const AgentName = {
  VERONICA: 'veronica',
  HAPPY: 'happy',
  DUME: 'dume',
} as const;
export type AgentName = (typeof AgentName)[keyof typeof AgentName];

export const AGENT_ALIASES: Readonly<Record<AgentName, readonly string[]>> = {
  [AgentName.VERONICA]: ['veronica', 'вероніка', 'вероніко', 'вероніку'],
  [AgentName.HAPPY]: ['happy', 'хеппі'],
  [AgentName.DUME]: ['dum-e', 'dume', 'дум-і', 'думі'],
};

export const PRIVATE_CHAT_TYPE = 'private';

export const CommandLabel = {
  NONE: 'none',
  UNKNOWN: 'unknown',
  FREE_TEXT: 'free_text',
} as const;
export type CommandLabel = ChatCommand | (typeof CommandLabel)[keyof typeof CommandLabel];

export const ChatOutcome = {
  HANDLED: 'handled',
  FAILED: 'failed',
  IGNORED: 'ignored',
  REJECTED: 'rejected',
  ANSWERED: 'answered',
  FLAGGED: 'flagged',
  FALLBACK: 'fallback',
} as const;
export type ChatOutcome = (typeof ChatOutcome)[keyof typeof ChatOutcome];

export const ChatRoute = {
  NONE: 'none',
  COMMAND: 'command',
  INVESTIGATION: 'investigation',
  HAPPY: 'happy',
} as const;
export type ChatRoute = (typeof ChatRoute)[keyof typeof ChatRoute];

export const MESSAGE_TEXT_MAX_CHARS = 4096;

export const WEBHOOK_ALLOWED_UPDATES: readonly string[] = ['message'];
