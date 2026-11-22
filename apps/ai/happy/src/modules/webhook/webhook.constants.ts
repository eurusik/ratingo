export const REVIEW_QUEUE = 'review';
export const REVIEW_QUEUE_PREFIX = 'ai-happy';

export const REVIEW_JOB_TYPES = {
  REVIEW_PULL_REQUEST: 'review-pull-request',
} as const;

const SECONDS_PER_DAY = 24 * 60 * 60;
const RETRY_BACKOFF_MS = 30_000;

export const REVIEW_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
  removeOnComplete: { age: 7 * SECONDS_PER_DAY },
  removeOnFail: { age: 14 * SECONDS_PER_DAY },
} as const;

export const REVIEW_REDIS = Symbol('REVIEW_REDIS');
export const REVIEW_QUEUE_INSTANCE = Symbol('REVIEW_QUEUE_INSTANCE');
