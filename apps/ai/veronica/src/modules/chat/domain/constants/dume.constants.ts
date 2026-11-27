const SECONDS = 1000;
const MINUTES = 60 * SECONDS;
const DAYS_IN_SECONDS = 24 * 60 * 60;

export const DUME_FOLLOW_UP_FIRST_DELAY_MS = 30 * SECONDS;
export const DUME_FOLLOW_UP_INTERVAL_MS = 30 * SECONDS;
export const DUME_DEADLINE_MS = 15 * MINUTES;
export const DUME_REQUEST_TIMEOUT_MS = 10 * SECONDS;

export const DUME_INFLIGHT_TTL_SECONDS = (DUME_DEADLINE_MS + 5 * MINUTES) / SECONDS;
export const DUME_DELIVERED_TTL_SECONDS = 3 * DAYS_IN_SECONDS;
export const DUME_SENDING_TTL_SECONDS = 45;

export const DUME_REQUEST_ID_PREFIX = 'tg';
export const DUME_DEFAULT_REF = 'main';
export const ASK_DUME_QUESTION_MAX_CHARS = 1000;

export const DUME_MESSAGE_BUDGET_CHARS = 4000;
export const DUME_MAX_MESSAGES = 3;
export const DUME_ANSWER_MAX_CHARS = 700;
export const DUME_FACT_MAX_CHARS = 300;
export const DUME_NOTE_MAX_CHARS = 300;
export const DUME_EVIDENCE_SUMMARY_MAX_CHARS = 160;
export const DUME_CITATIONS_SHOWN = 3;
export const DUME_EVIDENCE_SHOWN = 2;
export const DUME_LIST_ITEMS_SHOWN = 6;
export const DUME_MEMORY_ANSWER_MAX_CHARS = 400;

export const GITHUB_WEB_ORIGIN = 'https://github.com';

export const DumeFollowUpAction = {
  DELIVER: 'deliver',
  WAIT: 'wait',
  NOT_FOUND: 'not_found',
  GIVE_UP: 'give_up',
} as const;
export type DumeFollowUpAction = (typeof DumeFollowUpAction)[keyof typeof DumeFollowUpAction];

export const DelegationStatus = {
  STARTED: 'started',
  ALREADY_STARTED: 'already_started',
  ALREADY_RUNNING: 'already_running',
  REJECTED: 'rejected',
  UNAVAILABLE: 'unavailable',
} as const;
export type DelegationStatus = (typeof DelegationStatus)[keyof typeof DelegationStatus];
