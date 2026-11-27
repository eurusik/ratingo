import { FixedClock } from '@ratingo/ai-core';

import { JobFailuresExecutor } from '../job-failures/job-failures.executor';
import { MetricsQueryExecutor } from '../metrics/metrics-query.executor';
import { PrometheusMetricsAdapter } from '../metrics/prometheus.metrics-adapter';
import * as PromQueries from '../metrics/prom-queries';

import { createJobFailuresSimulator, type SimulatedJobFailureDay } from './job-failures.simulator';
import { createPrometheusSimulator } from './prometheus.simulator';

const NOW_MS = Date.UTC(2026, 10, 26, 12, 0, 0);
const HOUR_MS = 3_600_000;

const day = (overrides: Partial<SimulatedJobFailureDay> = {}): SimulatedJobFailureDay => ({
  day: '2026-11-26',
  schedulerJobId: 'scheduled-trending',
  jobType: 'sync-trending-dispatcher',
  queue: 'ingestion',
  errorClass: 'rate_limit',
  failures: 4,
  exhausted: 1,
  firstFailedAtMs: NOW_MS - 6 * HOUR_MS,
  lastFailedAtMs: NOW_MS - 2 * HOUR_MS,
  lastMessage: 'Trakt API: 429',
  ...overrides,
});

describe('createJobFailuresSimulator', () => {
  const since = (rows: SimulatedJobFailureDay[], filter = {}) =>
    createJobFailuresSimulator(rows).since({
      firstKyivDay: '2026-11-25',
      lastKyivDay: '2026-11-26',
      ...filter,
    });

  it('sums the days of one group and keeps the newest message', async () => {
    const rows = [
      day({ day: '2026-11-25', failures: 3, lastFailedAtMs: NOW_MS - 30 * HOUR_MS }),
      day({ lastMessage: 'newest' }),
    ];

    expect(await since(rows)).toEqual([
      expect.objectContaining({ failures: 7, attemptsExhausted: 2, lastMessage: 'newest' }),
    ]);
  });

  it('filters by a part of the job type or scheduler name, by queue and by day', async () => {
    const rows = [day(), day({ schedulerJobId: null, jobType: 'sync-show', queue: 'stats' })];

    expect(await since(rows, { job: 'trending' })).toHaveLength(1);
    expect(await since(rows, { job: 'sync-show' })).toHaveLength(1);
    expect(await since(rows, { queue: 'stats' })).toHaveLength(1);
    expect(await since([day({ day: '2026-11-20' })])).toEqual([]);
  });

  it('feeds the real executor, which words an empty list itself', async () => {
    const executor = new JobFailuresExecutor(
      createJobFailuresSimulator([]),
      new FixedClock(NOW_MS),
    );

    const result = (await executor.run({})) as { withAllRows(): { note: string } };

    expect(result.withAllRows().note).toContain('No failed job attempt was recorded');
  });
});

describe('createPrometheusSimulator', () => {
  const promql = PromQueries.queueBacklog('ingestion');

  it('answers the exact query and nothing for any other', async () => {
    const adapter = new PrometheusMetricsAdapter(
      { baseUrl: 'https://prom.example.invalid', token: 'token' },
      createPrometheusSimulator(
        [{ promql, samples: [{ labels: { queue: 'ingestion' }, value: 7 }] }],
        NOW_MS,
      ),
    );

    expect(await adapter.instant(promql, NOW_MS)).toEqual([
      { labels: { queue: 'ingestion' }, value: 7 },
    ]);
    expect(await adapter.instant(PromQueries.queueBacklog('stats'), NOW_MS)).toEqual([]);
  });

  it('feeds the real metrics executor', async () => {
    const adapter = new PrometheusMetricsAdapter(
      { baseUrl: 'https://prom.example.invalid', token: 'token' },
      createPrometheusSimulator([], NOW_MS),
    );

    const result = await new MetricsQueryExecutor(adapter, new FixedClock(NOW_MS)).run({
      template: 'infra_health',
    });

    expect(result).toBeDefined();
  });
});
