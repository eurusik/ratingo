const SECONDS_PER_DAY = 24 * 60 * 60;
const ONE_MINUTE_MS = 60_000;

export const CHAT_QUEUE = 'chat';
export const CHAT_QUEUE_PREFIX = 'ai-veronica';
export const CHAT_JOB_ID_PREFIX = 'telegram-';
export const CHAT_WORKER_CONCURRENCY = 2;

export const CHAT_JOB_TYPES = {
  MESSAGE: 'chat-message',
} as const;

export const CHAT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: ONE_MINUTE_MS },
  removeOnComplete: { age: SECONDS_PER_DAY },
  removeOnFail: { age: 7 * SECONDS_PER_DAY },
} as const;

export const CHAT_TASK_NAME = 'chat';
export const NO_MODEL = 'none';

export const WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';
export const WEBHOOK_ROUTE_PREFIX = 'webhooks';
export const WEBHOOK_ROUTE = 'telegram';

export const REDIS_CONNECTION = Symbol('CHAT_REDIS_CONNECTION');
export const CHAT_QUEUE_TOKEN = Symbol('CHAT_QUEUE');
