import { FixedClock, RowList, fitRowList } from '@ratingo/ai-core';

import { JOB_FAILURES_OUTPUT_CAP } from './job-failures.constants';
import type { JobFailureFilter, JobFailureSummary } from './job-failures.port';

import { JobFailuresExecutor } from './job-failures.executor';

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);
const HOUR_MS = 3_600_000;

const summary = (overrides: Partial<JobFailureSummary> = {}): JobFailureSummary => ({
  job: 'scheduled-trending',
  jobType: 'sync-trending-dispatcher',
  queue: 'ingestion',
  errorClass: 'rate_limit',
  failures: 12,
  attemptsExhausted: 3,
  firstFailedAtMs: Date.UTC(2026, 10, 22, 6, 0),
  lastFailedAtMs: Date.UTC(2026, 10, 22, 10, 15),
  lastMessage: 'Trakt API: 429 Too Many Requests',
  ...overrides,
});

const executorReturning = (rows: JobFailureSummary[], asked: JobFailureFilter[] = []) =>
  new JobFailuresExecutor(
    {
      since: async (filter) => {
        asked.push(filter);
        return rows;
      },
    },
    new FixedClock(NOW_MS),
  );

const materialized = (result: unknown): unknown =>
  result instanceof RowList ? result.withAllRows() : result;

describe('JobFailuresExecutor', () => {
  it('returns rows sorted by failures with Kyiv times and the filters it used', async () => {
    const asked: JobFailureFilter[] = [];
    const executor = executorReturning(
      [
        summary({ job: 'sync-show', jobType: 'sync-show', failures: 2, errorClass: 'not_found' }),
        summary(),
      ],
      asked,
    );

    const result = materialized(await executor.run({ queue: 'ingestion', window: '48h' }));

    expect(asked).toEqual([
      { firstKyivDay: '2026-11-20', lastKyivDay: '2026-11-22', job: undefined, queue: 'ingestion' },
    ]);
    expect(result).toEqual({
      window: '48h',
      countedKyivDays: { from: '2026-11-20', to: '2026-11-22' },
      queue: 'ingestion',
      failures: [
        {
          job: 'scheduled-trending',
          jobType: 'sync-trending-dispatcher',
          queue: 'ingestion',
          errorClass: 'rate_limit',
          failuresOnThoseDays: 12,
          attemptsExhaustedOnThoseDays: 3,
          firstFailedAtKyiv: '2026-11-22 08:00',
          lastFailedAtKyiv: '2026-11-22 12:15',
          lastMessage: 'Trakt API: 429 Too Many Requests',
        },
        {
          job: 'sync-show',
          queue: 'ingestion',
          errorClass: 'not_found',
          failuresOnThoseDays: 2,
          attemptsExhaustedOnThoseDays: 3,
          firstFailedAtKyiv: '2026-11-22 08:00',
          lastFailedAtKyiv: '2026-11-22 12:15',
          lastMessage: 'Trakt API: 429 Too Many Requests',
        },
      ],
    });
  });

  it('returns an empty list with a note that handled errors are only in the logs', async () => {
    const result = materialized(await executorReturning([]).run({}));

    expect(result).toEqual({
      window: '24h',
      countedKyivDays: { from: '2026-11-21', to: '2026-11-22' },
      failures: [],
      note: expect.stringContaining('only in logs_search'),
    });
  });

  it('says the note applies to the filter when job or queue is set', async () => {
    const byJob = materialized(await executorReturning([]).run({ job: 'trending' }));
    const byQueue = materialized(await executorReturning([]).run({ queue: 'ingestion' }));

    expect(byJob).toMatchObject({ note: expect.stringContaining('matching this filter') });
    expect(byQueue).toMatchObject({ note: expect.stringContaining('matching this filter') });
    expect(materialized(await executorReturning([]).run({}))).not.toMatchObject({
      note: expect.stringContaining('matching this filter'),
    });
  });

  it('adds no note when failures were recorded', async () => {
    const result = materialized(await executorReturning([summary()]).run({}));

    expect(result).not.toHaveProperty('note');
  });

  it('counts whole Kyiv days for a window of a few hours', async () => {
    const asked: JobFailureFilter[] = [];
    const result = materialized(await executorReturning([], asked).run({ window: '6h' }));

    expect(asked[0]).toMatchObject({ firstKyivDay: '2026-11-22', lastKyivDay: '2026-11-22' });
    expect(result).toMatchObject({ countedKyivDays: { from: '2026-11-22', to: '2026-11-22' } });
  });

  it('keeps whole rows within the output cap and names the filters in the hint', async () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      summary({ job: `job-${index}`, failures: 100 - index, lastMessage: 'x'.repeat(300) }),
    );
    const result = await executorReturning(rows).run({});
    const text = fitRowList(result as RowList, JOB_FAILURES_OUTPUT_CAP);
    const parsed = JSON.parse(text) as { failures: unknown[]; omitted: number; hint: string };

    expect(text.length).toBeLessThanOrEqual(JOB_FAILURES_OUTPUT_CAP);
    expect(parsed.failures.length + parsed.omitted).toBe(60);
    expect(parsed.hint).toContain('job=');
    expect(parsed.hint).toContain('queue=');
  });

  it.each([
    [{ window: '30d' }, 'window must'],
    [{ job: 'Sync Show' }, 'job must'],
    [{ queue: 'bad queue!' }, 'invalid queue'],
  ])('rejects %j before querying', async (input, message) => {
    const asked: JobFailureFilter[] = [];
    await expect(executorReturning([], asked).run(input)).rejects.toThrow(message);
    expect(asked).toEqual([]);
  });
});
