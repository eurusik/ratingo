import fc from 'fast-check';

import { buildLogRecord, type LogRecord } from './log-record';
import { RepeatCollapser } from './repeat-collapser';

const record = (level: LogRecord['level'], message: string, context = 'Sync'): LogRecord =>
  buildLogRecord(
    { service: 'worker', environment: 'production' },
    { level, message, context },
    new Date(0),
  );

const WINDOW_MS = 60_000;

describe('RepeatCollapser', () => {
  it('lets the first warning through and suppresses repeats with different ids', () => {
    const collapser = new RepeatCollapser(WINDOW_MS);

    expect(collapser.accept(record('warn', 'Trakt data failed for TMDB 101'), 0)).toBe(true);
    expect(collapser.accept(record('warn', 'Trakt data failed for TMDB 202'), 1_000)).toBe(false);
    expect(collapser.accept(record('warn', 'Trakt data failed for TMDB 303'), 2_000)).toBe(false);
  });

  it('keeps different messages and different contexts apart', () => {
    const collapser = new RepeatCollapser(WINDOW_MS);

    expect(collapser.accept(record('error', 'disk full'), 0)).toBe(true);
    expect(collapser.accept(record('error', 'network down'), 0)).toBe(true);
    expect(collapser.accept(record('error', 'disk full', 'Other'), 0)).toBe(true);
  });

  it('never suppresses info or debug records', () => {
    const collapser = new RepeatCollapser(WINDOW_MS);

    expect(collapser.accept(record('info', 'tick'), 0)).toBe(true);
    expect(collapser.accept(record('info', 'tick'), 1)).toBe(true);
  });

  it('emits one summary with the count once the window is over, then starts a new window', () => {
    const collapser = new RepeatCollapser(WINDOW_MS);
    collapser.accept(record('error', 'boom'), 0);
    collapser.accept(record('error', 'boom'), 1_000);
    collapser.accept(record('error', 'boom'), 2_000);

    expect(collapser.drainSummaries(30_000)).toEqual([]);
    const summaries = collapser.drainSummaries(WINDOW_MS + 1);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ message: 'boom', repeats: 2, level: 'error' });
    expect(collapser.accept(record('error', 'boom'), WINDOW_MS + 2)).toBe(true);
  });

  it('writes no summary for a warning that never repeated', () => {
    const collapser = new RepeatCollapser(WINDOW_MS);
    collapser.accept(record('warn', 'once'), 0);

    expect(collapser.drainSummaries(WINDOW_MS + 1)).toEqual([]);
  });

  it('can drain open windows on shutdown', () => {
    const collapser = new RepeatCollapser(WINDOW_MS);
    collapser.accept(record('warn', 'again'), 0);
    collapser.accept(record('warn', 'again'), 10);

    expect(collapser.drainSummaries(20, true)).toHaveLength(1);
  });

  it('passes exactly one record per distinct message and counts the rest', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 60 }),
        (messages) => {
          const collapser = new RepeatCollapser(WINDOW_MS);
          const passed = messages.filter((message) =>
            collapser.accept(record('error', message), 0),
          );
          const summaries = collapser.drainSummaries(WINDOW_MS, true);
          const suppressed = summaries.reduce((sum, summary) => sum + Number(summary.repeats), 0);
          return (
            passed.length === new Set(messages).size &&
            passed.length + suppressed === messages.length
          );
        },
      ),
    );
  });
});
