export const INVESTIGATION_QUEUE_NAME = 'investigations';
export const INVESTIGATION_QUEUE_PREFIX = 'ai-dume';
export const INVESTIGATION_JOB_NAME = 'investigate';
export const INVESTIGATION_WORKER_CONCURRENCY = 1;

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export const INVESTIGATION_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: { age: SECONDS_PER_HOUR },
  removeOnFail: { age: SECONDS_PER_DAY },
} as const;

const STATE_KEY_PREFIX = 'ai-dume-state:';
export const RECORD_KEY_PREFIX = `${STATE_KEY_PREFIX}investigation:`;
export const COUNT_KEY_PREFIX = `${STATE_KEY_PREFIX}accepted:`;
export const RECORD_TTL_SECONDS = 3 * SECONDS_PER_DAY;
export const COUNT_TTL_SECONDS = 2 * SECONDS_PER_DAY;

export const STATE_REDIS = Symbol('DUME_STATE_REDIS');
export const QUEUE_REDIS = Symbol('DUME_QUEUE_REDIS');

export const MAX_BODY_BYTES = 8 * 1024;
export const REDIS_COMMAND_TIMEOUT_MS = 2_000;
export const QUEUE_CALL_TIMEOUT_MS = 3_000;
export const WORKER_LOCK_MS = 5 * 60_000;
export const FINAL_SAVE_DELAYS = Symbol('DUME_FINAL_SAVE_DELAYS');
export const FINAL_SAVE_RETRY_DELAYS_MS: readonly number[] = [250, 1_000, 4_000];
