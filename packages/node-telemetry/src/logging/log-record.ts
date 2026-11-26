import { getLogContext } from './log-context';
import type { LogLevel } from './log-level';
import { redactText, redactValue } from './redaction';

const MAX_MESSAGE_LENGTH = 8_000;

const MAX_STACK_LENGTH = 16_000;

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
    .map(([key, value]) => [toSnakeCase(key), value]);
  return Object.fromEntries(entries.filter(([key]) => !RESERVED_KEYS.has(key)));
};

export function buildLogRecord(identity: LogIdentity, input: LogInput, time: Date): LogRecord {
  return {
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
}

export const serializeLogRecord = (record: LogRecord): string => JSON.stringify(record);
