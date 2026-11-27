export const RequestState = {
  QUEUED: 'queued',
  RUNNING: 'running',
  ANSWERED: 'answered',
  FAILED: 'failed',
} as const;
export type RequestState = (typeof RequestState)[keyof typeof RequestState];

export const FailureReason = {
  BUDGET_STOP: 'budget_stop',
  TIMEOUT: 'timeout',
  MODEL_ERROR: 'model_error',
  NO_VALID_ANSWER: 'no_valid_answer',
  CODE_UNAVAILABLE: 'code_unavailable',
  DAY_BUDGET: 'day_budget',
  INTERRUPTED: 'interrupted',
  INTERNAL_ERROR: 'internal_error',
} as const;
export type FailureReason = (typeof FailureReason)[keyof typeof FailureReason];

export const RejectionReason = {
  DAY_BUDGET: 'day_budget',
  DAILY_COUNT_CAP: 'daily_count_cap',
  QUEUE_FULL: 'queue_full',
} as const;
export type RejectionReason = (typeof RejectionReason)[keyof typeof RejectionReason];

export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
export const MAX_WAITING_REQUESTS = 2;
export const STALE_RUNNING_MARGIN_MS = 60_000;
export const SNAPSHOT_PHASE_ALLOWANCE_MS = 5 * 60_000;
export const RECORD_VERSION = 1;
export const TERMINAL_STATES: readonly RequestState[] = [
  RequestState.ANSWERED,
  RequestState.FAILED,
];
