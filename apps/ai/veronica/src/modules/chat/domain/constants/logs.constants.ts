export const LOG_ENVIRONMENT = 'production';

export const LogService = {
  API: 'ratingo-api',
  WORKER: 'ratingo-worker',
  STOREFRONT: 'ratingo-storefront',
  VERONICA: 'ratingo-veronica',
  HAPPY: 'ratingo-happy',
  BACKUP: 'ratingo-backup',
} as const;
export type LogService = (typeof LogService)[keyof typeof LogService];

export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const LogSearchMode = {
  GROUPED: 'grouped',
  LINES: 'lines',
} as const;
export type LogSearchMode = (typeof LogSearchMode)[keyof typeof LogSearchMode];

export const LogsFailureClass = {
  NOT_CONFIGURED: 'not_configured',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  ACCESS_DENIED: 'access_denied',
  RATE_LIMIT: 'rate_limit',
  BAD_QUERY: 'bad_query',
  SERVER_ERROR: 'server_error',
  TOO_LARGE: 'too_large',
  OTHER: 'other',
} as const;
export type LogsFailureClass = (typeof LogsFailureClass)[keyof typeof LogsFailureClass];

export const LOG_DEFAULT_WINDOW = '24h';
export const LOG_DEFAULT_LEVEL = LogLevel.ERROR;
export const LOG_DEFAULT_MODE = LogSearchMode.GROUPED;

export const LOG_TEXT_MAX_CHARS = 100;
export const LOG_ID_MAX_CHARS = 128;

export const LOG_FETCH_LIMIT_GROUPED = 300;
export const LOG_FETCH_LIMIT_LINES = 60;

export const LOG_SEARCH_OUTPUT_CAP = 4500;
export const LOG_MESSAGE_MAX_CHARS = 160;
export const LOG_STACK_HEAD_MAX_CHARS = 240;
export const LOG_STACK_HEAD_MAX_LINES = 3;
export const LOG_CONTEXT_MAX_CHARS = 60;
export const LOG_FIELD_MAX_CHARS = 80;

export const LOG_NARROWING_HINT =
  'pass a shorter window, text=<part of the message>, or an exact job_id, request_id, run_id or queue';
