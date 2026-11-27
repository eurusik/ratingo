import * as fc from 'fast-check';

import type { LogEntry } from './log-entry';

import {
  groupLogEntries,
  newestFirst,
  normalizeLogText,
  parseLogLine,
  shortened,
  stackHead,
} from './log-entry.policy';

const AT_MS = Date.UTC(2026, 10, 26, 9, 30, 0);

const entry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  atMs: AT_MS,
  level: 'error',
  context: 'JobFailures',
  message: 'Job failed',
  occurrences: 1,
  ...overrides,
});

const line = (record: Record<string, unknown>): string => JSON.stringify(record);

describe('parseLogLine', () => {
  it('reads the fixed fields, the error fields and the correlation ids', () => {
    expect(
      parseLogLine({
        atMs: AT_MS,
        line: line({
          time: '2026-11-26T09:30:00.000Z',
          level: 'error',
          service: 'ratingo-worker',
          context: 'SyncShow',
          message: 'Job failed',
          error_name: 'TimeoutError',
          error_message: 'TMDB timed out',
          error_stack: 'TimeoutError: TMDB timed out\n    at fetch (a.ts:1:1)',
          job_id: 'sync-show:4812',
          queue: 'ingestion',
          request_id: 'req-7',
          run_id: 42,
        }),
      }),
    ).toEqual({
      atMs: AT_MS,
      level: 'error',
      context: 'SyncShow',
      message: 'Job failed',
      occurrences: 1,
      errorName: 'TimeoutError',
      errorMessage: 'TMDB timed out',
      errorStack: 'TimeoutError: TMDB timed out\n    at fetch (a.ts:1:1)',
      jobId: 'sync-show:4812',
      queue: 'ingestion',
      requestId: 'req-7',
      runId: '42',
    });
  });

  it('counts a repeat summary as the repeats it stands for', () => {
    expect(
      parseLogLine({ atMs: AT_MS, line: line({ level: 'warn', message: 'x', repeats: 7 }) })
        .occurrences,
    ).toBe(7);
    expect(
      parseLogLine({ atMs: AT_MS, line: line({ level: 'warn', message: 'x', repeats: -3 }) })
        .occurrences,
    ).toBe(1);
  });

  it.each(['plain text line', '[1,2]', 'null', '"quoted"', '{broken'])(
    'keeps «%s» as a message of unknown level',
    (raw) => {
      expect(parseLogLine({ atMs: AT_MS, line: raw })).toEqual({
        atMs: AT_MS,
        level: 'unknown',
        context: '',
        message: raw,
        occurrences: 1,
      });
    },
  );
});

describe('normalizeLogText', () => {
  it('strips numbers, ids and uuids', () => {
    expect(
      normalizeLogText(
        'Job 4812 failed after 3 attempts for 0b9f1c52-7a41-4a53-9a27-6c1f9f0d3e11 (abcdef0123456789)',
      ),
    ).toBe('Job <n> failed after <n> attempts for <id> (<id>)');
  });

  it('keeps words that only look like hex', () => {
    expect(normalizeLogText('deadbeef cafe decade')).toBe('deadbeef cafe decade');
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        const once = normalizeLogText(text);
        expect(normalizeLogText(once)).toBe(once);
      }),
    );
  });
});

describe('groupLogEntries', () => {
  it('groups the same error with different numbers and keeps count, span and the newest sample', () => {
    const groups = groupLogEntries([
      entry({ atMs: AT_MS, message: 'Job 1 failed', jobId: 'a' }),
      entry({ atMs: AT_MS + 60_000, message: 'Job 22 failed', jobId: 'b' }),
      entry({ atMs: AT_MS + 30_000, message: 'Job 303 failed', jobId: 'c' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      count: 3,
      firstAtMs: AT_MS,
      lastAtMs: AT_MS + 60_000,
      level: 'error',
      context: 'JobFailures',
      sample: { jobId: 'b' },
    });
  });

  it('separates different errors, contexts, levels and error names and puts the most frequent first', () => {
    const groups = groupLogEntries([
      entry({ message: 'rate limited', context: 'Trakt', atMs: AT_MS + 10 }),
      entry({ message: 'boom', errorName: 'TimeoutError' }),
      entry({ message: 'boom', errorName: 'TimeoutError', atMs: AT_MS + 1 }),
      entry({ message: 'boom', errorName: 'TypeError', atMs: AT_MS + 30 }),
      entry({ message: 'boom', level: 'warn', errorName: 'TimeoutError', atMs: AT_MS + 20 }),
    ]);

    expect(groups.map((group) => [group.context, group.level, group.count])).toEqual([
      ['JobFailures', 'error', 2],
      ['JobFailures', 'error', 1],
      ['JobFailures', 'warn', 1],
      ['Trakt', 'error', 1],
    ]);
  });

  it('adds a repeat summary to the count as the repeats it stands for', () => {
    const [group] = groupLogEntries([
      entry({ message: 'x' }),
      entry({ message: 'x', occurrences: 9, atMs: AT_MS + 60_000 }),
    ]);
    expect(group.count).toBe(10);
  });

  describe('properties', () => {
    const anyEntry = fc.record({
      atMs: fc.integer({ min: AT_MS, max: AT_MS + 86_400_000 }),
      level: fc.constantFrom('error', 'warn'),
      context: fc.constantFrom('A', 'B', 'C'),
      message: fc.constantFrom('Job 1 failed', 'Job 2 failed', 'other', 'x 9'),
      occurrences: fc.integer({ min: 1, max: 50 }),
    });

    it('keeps every occurrence: group counts add up to the entries', () => {
      fc.assert(
        fc.property(fc.array(anyEntry, { maxLength: 80 }), (entries) => {
          const groups = groupLogEntries(entries);
          const total = entries.reduce((sum, item) => sum + item.occurrences, 0);
          expect(groups.reduce((sum, group) => sum + group.count, 0)).toBe(total);
        }),
      );
    });

    it('orders groups by count then recency and keeps first before last', () => {
      fc.assert(
        fc.property(fc.array(anyEntry, { maxLength: 80 }), (entries) => {
          const groups = groupLogEntries(entries);
          groups.forEach((group, index) => {
            expect(group.firstAtMs).toBeLessThanOrEqual(group.lastAtMs);
            expect(group.sample.atMs).toBe(group.lastAtMs);
            const next = groups[index + 1];
            if (next !== undefined) {
              expect(group.count > next.count || group.lastAtMs >= next.lastAtMs).toBe(true);
            }
          });
        }),
      );
    });

    it('does not depend on the order of the entries for counts and spans', () => {
      fc.assert(
        fc.property(fc.array(anyEntry, { maxLength: 60 }), (entries) => {
          const summarize = (list: readonly LogEntry[]) =>
            groupLogEntries(list)
              .map((group) => [group.context, group.level, group.count, group.firstAtMs])
              .sort();
          expect(summarize([...entries].reverse())).toEqual(summarize(entries));
        }),
      );
    });
  });
});

describe('newestFirst', () => {
  it('orders by time descending without changing the input', () => {
    const input = [entry({ atMs: 1 }), entry({ atMs: 3 }), entry({ atMs: 2 })];
    expect(newestFirst(input).map((item) => item.atMs)).toEqual([3, 2, 1]);
    expect(input.map((item) => item.atMs)).toEqual([1, 3, 2]);
  });
});

describe('shortened and stackHead', () => {
  it('flattens whitespace and cuts with an ellipsis within the limit', () => {
    expect(shortened('a\n  b   c', 20)).toBe('a b c');
    expect(shortened('abcdefghij', 5)).toBe('abcd…');
  });

  it('never exceeds the limit', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), fc.integer({ min: 2, max: 100 }), (text, max) => {
        expect(shortened(text, max).length).toBeLessThanOrEqual(max);
      }),
    );
  });

  it('keeps the first lines of a stack in one line', () => {
    expect(
      stackHead('Error: x\n    at a (a.ts:1:1)\n    at b (b.ts:2:2)\n    at c (c.ts:3:3)', 2, 100),
    ).toBe('Error: x | at a (a.ts:1:1)');
  });
});
