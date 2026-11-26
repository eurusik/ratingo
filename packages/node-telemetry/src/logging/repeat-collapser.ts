import type { LogRecord } from './log-record';

const MAX_TRACKED_KEYS = 200;

const VARIABLE_PARTS = /[0-9a-f]{8,}|\d+/gi;

const COLLAPSED_LEVELS: ReadonlySet<string> = new Set(['warn', 'error']);

interface TrackedRepeat {
  readonly first: LogRecord;
  readonly windowStartMs: number;
  suppressed: number;
}

const keyOf = (record: LogRecord): string =>
  `${record.level}|${String(record.context)}|${record.message.replace(VARIABLE_PARTS, '#')}`;

export class RepeatCollapser {
  private readonly tracked = new Map<string, TrackedRepeat>();

  constructor(private readonly windowMs: number) {}

  accept(record: LogRecord, nowMs: number): boolean {
    if (!COLLAPSED_LEVELS.has(record.level)) {
      return true;
    }
    const key = keyOf(record);
    const existing = this.tracked.get(key);
    if (existing) {
      existing.suppressed += 1;
      return false;
    }
    if (this.tracked.size < MAX_TRACKED_KEYS) {
      this.tracked.set(key, { first: record, windowStartMs: nowMs, suppressed: 0 });
    }
    return true;
  }

  drainSummaries(nowMs: number, includeOpenWindows = false): LogRecord[] {
    const summaries: LogRecord[] = [];
    for (const [key, entry] of this.tracked) {
      if (!includeOpenWindows && nowMs - entry.windowStartMs < this.windowMs) {
        continue;
      }
      this.tracked.delete(key);
      if (entry.suppressed > 0) {
        summaries.push({
          ...entry.first,
          time: new Date(nowMs).toISOString(),
          repeats: entry.suppressed,
        });
      }
    }
    return summaries;
  }
}
