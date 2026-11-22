export const GithubEvent = {
  PING: 'ping',
  PULL_REQUEST: 'pull_request',
  ISSUE_COMMENT: 'issue_comment',
} as const;
export type GithubEvent = (typeof GithubEvent)[keyof typeof GithubEvent];

export const REVIEWABLE_PULL_REQUEST_ACTIONS: readonly string[] = [
  'opened',
  'ready_for_review',
  'reopened',
];

export const COMMENT_CREATED_ACTION = 'created';
export const DEFAULT_MENTION_HANDLE = 'happy-on-duty';
export const SLASH_COMMAND_PREFIX = '/happy';
export const COMMAND_VERBS: readonly string[] = ['scan', 'review'];
export const COLLABORATOR_ASSOCIATIONS: readonly string[] = ['OWNER', 'MEMBER', 'COLLABORATOR'];
export const BOT_SENDER_TYPE = 'Bot';

export const IgnoreReason = {
  ACTION_NOT_REVIEWABLE: 'action_not_reviewable',
  REPOSITORY_NOT_ALLOWED: 'repository_not_allowed',
  DRAFT: 'draft',
  UNTRUSTED_FORK: 'untrusted_fork',
  NOT_A_PULL_REQUEST: 'not_a_pull_request',
  NOT_A_COMMAND: 'not_a_command',
  NOT_A_COLLABORATOR: 'not_a_collaborator',
  BOT_SENDER: 'bot_sender',
  UNSUPPORTED_EVENT: 'unsupported_event',
} as const;
export type IgnoreReason = (typeof IgnoreReason)[keyof typeof IgnoreReason];

export const InternalSkipReason = {
  CLOSED: 'closed',
  MERGED: 'merged',
  UNTRUSTED_FORK: 'untrusted_fork',
} as const;
export type InternalSkipReason = (typeof InternalSkipReason)[keyof typeof InternalSkipReason];

export const InternalRequestStatus = {
  QUEUED: 'queued',
  ALREADY_RUNNING: 'already_running',
  ALREADY_REVIEWED: 'already_reviewed',
  SKIPPED: 'skipped',
  NOT_FOUND: 'not_found',
} as const;
export type InternalRequestStatus =
  (typeof InternalRequestStatus)[keyof typeof InternalRequestStatus];

export const MAX_PULL_NUMBER_DIGITS = 9;
export const OPEN_PULL_REQUESTS_LIMIT = 6;
export const INTERNAL_PROXY_HEADERS: readonly string[] = [
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'forwarded',
  'cf-connecting-ip',
  'cf-ray',
];
