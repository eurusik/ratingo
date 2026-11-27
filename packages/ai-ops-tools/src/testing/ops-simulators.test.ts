import { FixedClock } from '@ratingo/ai-core';

import { JobFailuresExecutor } from '../job-failures/job-failures.executor';
import { MetricsQueryExecutor } from '../metrics/metrics-query.executor';
import { PrometheusMetricsAdapter } from '../metrics/prometheus.metrics-adapter';
import {
  CLIENT_REQUESTS_METRIC,
  QUEUE_JOBS_METRIC,
  clientErrors,
  clientRequests,
  queueBacklog,
  queueBacklogPeak,
} from '../metrics/prom-queries';

import { createJobFailuresSimulator, type SimulatedJobFailureDay } from './job-failures.simulator';
import { createPrometheusSimulator, type PrometheusSeries } from './prometheus.simulator';
import { recordingLogger } from './recording-logger';

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
      recordingLogger(),
    );

    const result = (await executor.run({})) as { withAllRows(): { note: string } };

    expect(result.withAllRows().note).toContain('No failed job attempt was recorded');
  });
});

describe('createPrometheusSimulator', () => {
  const series: PrometheusSeries[] = [
    {
      metric: CLIENT_REQUESTS_METRIC,
      labels: { server_address: 'a.example', http_response_status_code: '200' },
      value: 90,
    },
    {
      metric: CLIENT_REQUESTS_METRIC,
      labels: { server_address: 'a.example', http_response_status_code: '429' },
      value: 7,
    },
    {
      metric: CLIENT_REQUESTS_METRIC,
      labels: { server_address: 'b.example', http_response_status_code: '429' },
      value: 3,
    },
    {
      metric: CLIENT_REQUESTS_METRIC,
      labels: { server_address: 'b.example', http_response_status_code: '503' },
      value: 1,
    },
    {
      metric: QUEUE_JOBS_METRIC,
      labels: { queue: 'ingestion', state: 'waiting' },
      value: 5,
      peak: 50,
    },
    { metric: QUEUE_JOBS_METRIC, labels: { queue: 'ingestion', state: 'active' }, value: 2 },
    { metric: QUEUE_JOBS_METRIC, labels: { queue: 'stats', state: 'delayed' }, value: 1, peak: 4 },
  ];
  const adapter = new PrometheusMetricsAdapter(
    { baseUrl: 'https://prom.example.invalid', token: 'token' },
    createPrometheusSimulator(series, NOW_MS),
  );
  const ask = (promql: string) => adapter.instant(promql, NOW_MS);

  it('answers a total over every series of the metric, whatever the window', async () => {
    const expected = [{ labels: {}, value: 101 }];

    expect(await ask(clientRequests('24h'))).toEqual(expected);
    expect(await ask(clientRequests('7d'))).toEqual(expected);
  });

  it('filters and groups by the labels in the query, so any parameterised call gets its samples', async () => {
    expect(await ask(clientErrors('24h'))).toEqual([
      { labels: { server_address: 'a.example', http_response_status_code: '429' }, value: 7 },
      { labels: { server_address: 'b.example', http_response_status_code: '429' }, value: 3 },
    ]);
    expect(await ask(clientErrors('6h', { provider: 'b.example' }))).toEqual([
      { labels: { server_address: 'b.example', http_response_status_code: '429' }, value: 3 },
    ]);
    expect(await ask(clientErrors('24h', { status: '503' }))).toEqual([
      { labels: { server_address: 'b.example', http_response_status_code: '503' }, value: 1 },
    ]);
  });

  it('counts only the backlog states and answers the peak with the peak values', async () => {
    expect(await ask(queueBacklog())).toEqual([
      { labels: { queue: 'ingestion' }, value: 5 },
      { labels: { queue: 'stats' }, value: 1 },
    ]);
    expect(await ask(queueBacklogPeak('24h', 'ingestion'))).toEqual([
      { labels: { queue: 'ingestion' }, value: 50 },
    ]);
    expect(await ask(queueBacklogPeak('3d'))).toEqual([
      { labels: { queue: 'ingestion' }, value: 50 },
      { labels: { queue: 'stats' }, value: 4 },
    ]);
  });

  it('answers nothing for a query it does not understand', async () => {
    expect(await ask('up')).toEqual([]);
  });

  it('feeds the real metrics executor', async () => {
    const result = await new MetricsQueryExecutor(
      adapter,
      new FixedClock(NOW_MS),
      recordingLogger(),
    ).run({
      template: 'http_client_errors',
      provider: 'a.example',
    });

    expect(JSON.stringify((result as { withAllRows(): unknown }).withAllRows())).toContain(
      '"count":7',
    );
  });
});
