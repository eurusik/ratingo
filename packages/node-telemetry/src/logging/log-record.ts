import { getLogContext } from './log-context';
import type { LogLevel } from './log-level';
import { redactText, redactValue } from './redaction';

const MAX_MESSAGE_LENGTH = 2_000;

const MAX_STACK_LENGTH = 2_500;

const MAX_FIELD_LENGTH = 500;

const MIN_TRIMMED_LENGTH = 200;

const DEFAULT_MAX_RECORD_BYTES = 4_096;

const TRUNCATION_MARKER_RESERVE = 40;

const RESERVED_KEYS = new Set([
  'time',
  'level',
  'service',
  'environment',
  'context',
  'message',
  'error_name',
  'error_message',
  'error_stack',
]);

export const CORRELATION_KEYS = ['job_id', 'queue', 'request_id', 'run_id'] as const;

export interface LogIdentity {
  readonly service: string;
  readonly environment: string;
}

export interface LogInput {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: string;
  readonly error?: unknown;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export type LogRecord = Readonly<Record<string, unknown>> & {
  readonly time: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly environment: string;
  readonly message: string;
};

const byteSize = (record: object): number => Buffer.byteLength(JSON.stringify(record));

const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength
    ? `${text.slice(0, maxLength)}…[truncated ${text.length - maxLength}]`
    : text;

const toSnakeCase = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase();

const describeError = (error: unknown): Record<string, string> => {
  if (error === undefined || error === null) {
    return {};
  }
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: truncate(redactText(error.message), MAX_MESSAGE_LENGTH),
      ...(error.stack && { error_stack: truncate(redactText(error.stack), MAX_STACK_LENGTH) }),
    };
  }
  return { error_message: truncate(redactText(String(error)), MAX_MESSAGE_LENGTH) };
};

const normalizeFields = (fields: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const redacted = redactValue(fields) as Record<string, unknown>;
  const entries: [string, unknown][] = Object.entries(redacted)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [
      toSnakeCase(key),
      typeof value === 'string' ? truncate(value, MAX_FIELD_LENGTH) : value,
    ]);
  return Object.fromEntries(entries.filter(([key]) => !RESERVED_KEYS.has(key)));
};

function trimField(record: Record<string, unknown>, key: string, overflow: number): number {
  const value = record[key];
  if (typeof value !== 'string' || value.length <= MIN_TRIMMED_LENGTH) {
    return overflow;
  }
  const keep = Math.max(MIN_TRIMMED_LENGTH, value.length - overflow - TRUNCATION_MARKER_RESERVE);
  record[key] = truncate(value, keep);
  return overflow - (value.length - keep);
}

function fitToBudget(record: LogRecord, maxBytes: number): LogRecord {
  const size = byteSize(record);
  if (size <= maxBytes) {
    return record;
  }
  const trimmed: Record<string, unknown> = { ...record };
  const afterStack = trimField(trimmed, 'error_stack', size - maxBytes);
  if (afterStack > 0) {
    trimField(trimmed, 'message', afterStack);
  }
  return trimmed as LogRecord;
}

export function buildLogRecord(
  identity: LogIdentity,
  input: LogInput,
  time: Date,
  maxRecordBytes = DEFAULT_MAX_RECORD_BYTES,
): LogRecord {
  const record: LogRecord = {
    time: time.toISOString(),
    level: input.level,
    service: identity.service,
    environment: identity.environment,
    ...(input.context && { context: input.context }),
    message: truncate(redactText(input.message), MAX_MESSAGE_LENGTH),
    ...normalizeFields(getLogContext()),
    ...normalizeFields(input.fields ?? {}),
    ...describeError(input.error),
  };
  return fitToBudget(record, maxRecordBytes);
}

export const serializeLogRecord = (record: LogRecord): string => JSON.stringify(record);
