import type { LogFormat } from './logger-settings';
import { serializeLogRecord, type LogRecord } from './log-record';

export type LogFormatter = (record: LogRecord) => string;

const LINE_FIELDS = new Set([
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

const TIME_OF_DAY_START = 11;

const TIME_OF_DAY_END = 23;

const LEVEL_WIDTH = 5;

const formatJson: LogFormatter = (record) => `${serializeLogRecord(record)}\n`;

const formatPretty: LogFormatter = (record) => {
  const clock = record.time.slice(TIME_OF_DAY_START, TIME_OF_DAY_END);
  const context = typeof record.context === 'string' ? ` [${record.context}]` : '';
  const extras = Object.entries(record)
    .filter(([key]) => !LINE_FIELDS.has(key))
    .map(([key, value]) => ` ${key}=${JSON.stringify(value)}`)
    .join('');
  const stack = typeof record.error_stack === 'string' ? `\n${record.error_stack}` : '';
  return `${clock} ${record.level.toUpperCase().padEnd(LEVEL_WIDTH)}${context} ${record.message}${extras}${stack}\n`;
};

export const formatterFor = (format: LogFormat): LogFormatter =>
  format === 'json' ? formatJson : formatPretty;
