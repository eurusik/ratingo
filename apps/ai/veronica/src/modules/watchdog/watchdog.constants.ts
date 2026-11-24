import { WATCHDOG_INTERVAL_MINUTES } from './domain/constants/watchdog-rules.constants';

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_HOUR = 60 * 60;

const ONE_MINUTE_MS = 60_000;

export const WATCHDOG_QUEUE = 'watchdog';
export const WATCHDOG_QUEUE_PREFIX = 'ai-veronica';
export const WATCHDOG_SCHEDULER_ID = 'watchdog-tick';
export const WATCHDOG_INTERVAL_MS = WATCHDOG_INTERVAL_MINUTES * ONE_MINUTE_MS;

export const WATCHDOG_JOB_TYPES = {
  TICK: 'watchdog-tick',
} as const;

export const WATCHDOG_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: { age: SECONDS_PER_HOUR },
  removeOnFail: { age: SECONDS_PER_DAY },
} as const;

export const WATCHDOG_STATE_KEYS = {
  ACTIVE: 'ai-veronica:watchdog-state:active',
  HAPPY_FAILURES: 'ai-veronica:watchdog-state:happy-failures',
} as const;
export const WATCHDOG_ACTIVE_TTL_SECONDS = 7 * SECONDS_PER_DAY;
export const WATCHDOG_HAPPY_FAILURES_TTL_SECONDS = SECONDS_PER_HOUR;

export const HAPPY_HEALTH_PATH = '/health';
export const HAPPY_HEALTH_TIMEOUT_MS = 5_000;

export const REDIS_CONNECTION = Symbol('WATCHDOG_REDIS_CONNECTION');
export const WATCHDOG_QUEUE_TOKEN = Symbol('WATCHDOG_QUEUE');
