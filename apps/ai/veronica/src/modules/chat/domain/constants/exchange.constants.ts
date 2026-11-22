const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const ExchangeOutcome = {
  ANSWERED: 'answered',
  REDACTED: 'redacted',
  FALLBACK: 'fallback',
  FAILED: 'failed',
} as const;
export type ExchangeOutcome = (typeof ExchangeOutcome)[keyof typeof ExchangeOutcome];

const EXCHANGE_RETENTION_DAYS = 30;
export const EXCHANGE_RETENTION_MS = EXCHANGE_RETENTION_DAYS * MS_PER_DAY;
export const EXCHANGE_TEXT_MAX_CHARS = 8000;

export const LAST_EXCHANGES_LIMIT = 3;
export const LAST_QUESTION_MAX_CHARS = 90;
export const COST_DECIMALS = 3;

export const EXPORT_DRAFT_ID_PREFIX = 'draft-';
export const EXPORT_DRAFT_ID_LENGTH = 8;
export const EXPORT_WINDOW_UNIT_MS = {
  h: MS_PER_HOUR,
  d: MS_PER_DAY,
} as const;
