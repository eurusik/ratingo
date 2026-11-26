import type { LogEntry, LogGroup } from '../entities/log-entry';
import type { RawLogLine } from '../ports/logs.port';

const UNKNOWN_LEVEL = 'unknown';
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_HEX = /\b(?=[0-9a-f]*\d)[0-9a-f]{8,}\b/gi;
const NUMBER = /\d+(?:[.,]\d+)*/g;
const WHITESPACE = /\s+/g;
const ELLIPSIS = '…';

const asText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value === '' ? undefined : value;
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
};

const occurrencesOf = (repeats: unknown): number =>
  typeof repeats === 'number' && Number.isInteger(repeats) && repeats > 0 ? repeats : 1;

const present = <T extends object>(fields: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

const entryFromRecord = (atMs: number, record: Record<string, unknown>): LogEntry => ({
  atMs,
  level: asText(record.level) ?? UNKNOWN_LEVEL,
  context: asText(record.context) ?? '',
  message: asText(record.message) ?? '',
  occurrences: occurrencesOf(record.repeats),
  ...present({
    errorName: asText(record.error_name),
    errorMessage: asText(record.error_message),
    errorStack: asText(record.error_stack),
    jobId: asText(record.job_id),
    queue: asText(record.queue),
    requestId: asText(record.request_id),
    runId: asText(record.run_id),
  }),
});

const parsedObject = (line: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const parseLogLine = (raw: RawLogLine): LogEntry => {
  const record = parsedObject(raw.line);
  return record === null
    ? { atMs: raw.atMs, level: UNKNOWN_LEVEL, context: '', message: raw.line, occurrences: 1 }
    : entryFromRecord(raw.atMs, record);
};

export const normalizeLogText = (text: string): string =>
  text
    .replace(UUID, '<id>')
    .replace(LONG_HEX, '<id>')
    .replace(NUMBER, '<n>')
    .replace(WHITESPACE, ' ')
    .trim();

const groupKey = (entry: LogEntry): string =>
  [
    entry.level,
    entry.context,
    entry.errorName ?? '',
    normalizeLogText(entry.message),
    normalizeLogText(entry.errorMessage ?? ''),
  ].join('\u0000');

const merged = (group: LogGroup, entry: LogEntry): LogGroup => ({
  ...group,
  count: group.count + entry.occurrences,
  firstAtMs: Math.min(group.firstAtMs, entry.atMs),
  lastAtMs: Math.max(group.lastAtMs, entry.atMs),
  sample: entry.atMs >= group.sample.atMs ? entry : group.sample,
});

const byCountThenRecency = (left: LogGroup, right: LogGroup): number =>
  right.count - left.count || right.lastAtMs - left.lastAtMs;

export const groupLogEntries = (entries: readonly LogEntry[]): LogGroup[] => {
  const groups = new Map<string, LogGroup>();
  for (const entry of entries) {
    const key = groupKey(entry);
    const existing = groups.get(key);
    groups.set(
      key,
      existing === undefined
        ? {
            count: entry.occurrences,
            firstAtMs: entry.atMs,
            lastAtMs: entry.atMs,
            level: entry.level,
            context: entry.context,
            sample: entry,
          }
        : merged(existing, entry),
    );
  }
  return [...groups.values()].sort(byCountThenRecency);
};

export const newestFirst = (entries: readonly LogEntry[]): LogEntry[] =>
  [...entries].sort((left, right) => right.atMs - left.atMs);

export const shortened = (text: string, maxChars: number): string => {
  const flat = text.replace(WHITESPACE, ' ').trim();
  return flat.length <= maxChars ? flat : `${flat.slice(0, maxChars - 1)}${ELLIPSIS}`;
};

export const stackHead = (stack: string, maxLines: number, maxChars: number): string =>
  shortened(
    stack
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .slice(0, maxLines)
      .join(' | '),
    maxChars,
  );
