export const DIGEST_TASK_NAME = 'daily-digest';
export const DIGEST_QUEUE = 'digest';
export const DIGEST_QUEUE_PREFIX = 'ai-veronica';

export const DIGEST_JOB_TYPES = {
  DAILY_DIGEST: 'daily-digest',
} as const;

const ONE_MINUTE_MS = 60_000;
const SECONDS_PER_DAY = 24 * 60 * 60;

export const DIGEST_JOB_OPTIONS = {
  attempts: 8,
  backoff: { type: 'exponential', delay: ONE_MINUTE_MS },
  removeOnComplete: { age: 7 * SECONDS_PER_DAY },
  removeOnFail: { age: 14 * SECONDS_PER_DAY },
} as const;

export const BASELINE_OFFSET_DAYS = 7;
export const REDIS_CONNECTION = Symbol('DIGEST_REDIS_CONNECTION');
export const DIGEST_QUEUE_TOKEN = Symbol('DIGEST_QUEUE');
