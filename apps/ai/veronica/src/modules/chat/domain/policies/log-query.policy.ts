import {
  LOG_ENVIRONMENT,
  LOG_ID_MAX_CHARS,
  LOG_TEXT_MAX_CHARS,
  LogLevel,
  LogService,
} from '../constants/logs.constants';
import type { LogQuery } from '../ports/logs.port';

import { isQueueName } from './metric-params.policy';

const MS_PER_HOUR = 3_600_000;
const SERVICES: readonly string[] = Object.values(LogService);
const LOG_ID_PATTERN = new RegExp(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,${LOG_ID_MAX_CHARS - 1}}$`);
const C0_CONTROL_MAX = 0x1f;
const DELETE_CODE = 0x7f;
const C1_CONTROL_MAX = 0x9f;
const LINE_SEPARATOR = 0x2028;
const PARAGRAPH_SEPARATOR = 0x2029;
const BACKTICK = '`';
const REGEX_METACHARACTERS = /[\\.+*?()|[\]{}^$]/g;

export interface LogSearchCriteria {
  service: string;
  level: string;
  windowHours: number;
  text?: string;
  jobId?: string;
  requestId?: string;
  runId?: string;
  queue?: string;
}

export class InvalidLogSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLogSearchError';
  }
}

const isLogService = (value: string): boolean => SERVICES.includes(value);

export const isLogId = (value: string): boolean => LOG_ID_PATTERN.test(value);

const isControlCode = (code: number): boolean =>
  code <= C0_CONTROL_MAX ||
  (code >= DELETE_CODE && code <= C1_CONTROL_MAX) ||
  code === LINE_SEPARATOR ||
  code === PARAGRAPH_SEPARATOR;

const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => isControlCode(character.codePointAt(0) ?? 0));

export const isLogText = (value: string): boolean =>
  value.trim() !== '' &&
  value.length <= LOG_TEXT_MAX_CHARS &&
  !value.includes(BACKTICK) &&
  !hasControlCharacter(value);

const escapedForRegex = (text: string): string => text.replace(REGEX_METACHARACTERS, '\\$&');

const rawString = (value: string): string => `${BACKTICK}${value}${BACKTICK}`;

const levelFilter = (level: string): string =>
  level === LogLevel.WARN
    ? `| detected_level=~${rawString(`${LogLevel.WARN}|${LogLevel.ERROR}`)}`
    : `| detected_level=${rawString(LogLevel.ERROR)}`;

const exactFilter = (
  label: string,
  value: string | undefined,
  isValid: (candidate: string) => boolean,
): string[] => {
  if (value === undefined) return [];
  if (!isValid(value)) {
    throw new InvalidLogSearchError(`${label} has characters that are not allowed`);
  }
  return [`| ${label}=${rawString(value)}`];
};

const textFilter = (text: string | undefined): string[] => {
  if (text === undefined) return [];
  if (!isLogText(text)) {
    throw new InvalidLogSearchError('text must be plain words without backticks or line breaks');
  }
  const pattern = rawString(`(?is).*${escapedForRegex(text.trim())}.*`);
  return [
    '| json message="message", error_message="error_message"',
    `| message=~${pattern} or error_message=~${pattern}`,
    '| drop message, error_message',
  ];
};

export const buildLogQuery = (
  criteria: LogSearchCriteria,
  nowMs: number,
  limit: number,
): LogQuery => {
  if (!isLogService(criteria.service)) throw new InvalidLogSearchError('unknown service');
  if (criteria.level !== LogLevel.ERROR && criteria.level !== LogLevel.WARN) {
    throw new InvalidLogSearchError('level must be error or warn');
  }
  const selector = `{service_name=${rawString(criteria.service)},deployment_environment_name=${rawString(LOG_ENVIRONMENT)}}`;
  const stages = [
    levelFilter(criteria.level),
    ...exactFilter('queue', criteria.queue, isQueueName),
    ...exactFilter('job_id', criteria.jobId, isLogId),
    ...exactFilter('request_id', criteria.requestId, isLogId),
    ...exactFilter('run_id', criteria.runId, isLogId),
    ...textFilter(criteria.text),
  ];
  return {
    logql: [selector, ...stages].join(' '),
    startMs: nowMs - criteria.windowHours * MS_PER_HOUR,
    endMs: nowMs,
    limit,
  };
};
