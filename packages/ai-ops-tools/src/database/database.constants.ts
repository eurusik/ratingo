export const DB_QUERY_ROW_LIMIT = 100;
export const DB_QUERY_OUTPUT_CAP = 8000;
export const DB_QUERY_MAX_SQL_CHARS = 4000;
export const DB_QUERY_CELL_MAX_CHARS = 1000;
export const DB_QUERY_CELL_HARD_MAX_CHARS = 4000;
export const DB_QUERY_ERROR_MESSAGE_CHARS = 300;
export const DB_SCHEMA_OUTPUT_CAP = 10_000;
export const DB_STATEMENT_TIMEOUT_MS = 5000;
export const DB_LOCK_TIMEOUT_MS = 2000;
export const DB_IDLE_IN_TRANSACTION_TIMEOUT_MS = 10_000;
export const DB_CONNECT_TIMEOUT_SECONDS = 10;
export const DB_CLIENT_DEADLINE_SLACK_MS = 2000;
export const DB_TABLE_FILTER_MAX_CHARS = 63;

export const QueryRefusal = {
  PRIVATE: 'private',
  NOT_FOUND: 'not_found',
  INVALID_QUERY: 'invalid_query',
  TIMEOUT: 'timeout',
  BUSY: 'busy',
  NOT_ALLOWED: 'not_allowed',
} as const;
export type QueryRefusal = (typeof QueryRefusal)[keyof typeof QueryRefusal];
