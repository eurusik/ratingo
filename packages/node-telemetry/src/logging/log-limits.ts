export interface LogLimits {
  readonly maxRecordBytes: number;
  readonly dedupeWindowMs: number;
  readonly maxRecordsPerMinute: number;
  readonly maxBytesPerDay: number;
}

const BYTES_PER_MEGABYTE = 1024 * 1024;

const MS_PER_SECOND = 1000;

export const DEFAULT_LOG_LIMITS: LogLimits = {
  maxRecordBytes: 4096,
  dedupeWindowMs: 60 * MS_PER_SECOND,
  maxRecordsPerMinute: 300,
  maxBytesPerDay: 12 * BYTES_PER_MEGABYTE,
};

type LimitsEnvironment = Readonly<Record<string, string | undefined>>;

function readPositiveInt(env: LimitsEnvironment, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name} "${raw}". Expected a positive integer`);
  }
  return value;
}

export function resolveLogLimits(env: LimitsEnvironment): LogLimits {
  return {
    maxRecordBytes: readPositiveInt(env, 'LOG_MAX_RECORD_BYTES', DEFAULT_LOG_LIMITS.maxRecordBytes),
    dedupeWindowMs:
      readPositiveInt(
        env,
        'LOG_DEDUPE_WINDOW_SECONDS',
        DEFAULT_LOG_LIMITS.dedupeWindowMs / MS_PER_SECOND,
      ) * MS_PER_SECOND,
    maxRecordsPerMinute: readPositiveInt(
      env,
      'LOG_SHIP_MAX_RECORDS_PER_MINUTE',
      DEFAULT_LOG_LIMITS.maxRecordsPerMinute,
    ),
    maxBytesPerDay: readPositiveInt(
      env,
      'LOG_SHIP_MAX_BYTES_PER_DAY',
      DEFAULT_LOG_LIMITS.maxBytesPerDay,
    ),
  };
}
