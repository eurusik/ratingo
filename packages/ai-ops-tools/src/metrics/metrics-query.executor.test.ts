import { FixedClock, RowList } from '@ratingo/ai-core';

import { recordingLogger } from '../testing/recording-logger';

import type { MetricSample } from './metrics.port';
import { METRIC_SERIES_CAP } from './metrics.constants';

import { MetricsQueryExecutor } from './metrics-query.executor';
import { MetricsNotConfiguredError, MetricsQueryError } from './prometheus.metrics-adapter';

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);
const DAY_MS = 86_400_000;

class Harness {
  readonly asked: { query: string; atMs: number }[] = [];
  samples: (query: string) => MetricSample[] = () => [];
  failure: Error | null = null;
  readonly logger = recordingLogger();

  readonly executor = new MetricsQueryExecutor(
    {
      instant: async (query, atMs) => {
        if (this.failure !== null) throw this.failure;
        this.asked.push({ query, atMs });
        return this.samples(query);
      },
    },
    new FixedClock(NOW_MS),
    this.logger,
  );
}

const materialized = (result: unknown): unknown =>
  result instanceof RowList ? result.withAllRows() : result;

describe('MetricsQueryExecutor', () => {
  it('runs the template queries at the current time with the window in the query', async () => {
    const harness = new Harness();
    harness.samples = (query) =>
      query.includes('result="completed"') ? [{ labels: { queue: 'ingestion' }, value: 90 }] : [];
    const result = materialized(
      await harness.executor.run({ template: 'queue_throughput', window: '6h' }),
    );
    expect(harness.asked.every((call) => call.atMs === NOW_MS)).toBe(true);
    expect(harness.asked.every((call) => call.query.includes('[6h]'))).toBe(true);
    expect(result).toMatchObject({
      template: 'queue_throughput',
      window: '6h',
      offsetDays: 0,
      evaluatedAtKyiv: '2026-11-22 14:00',
      data: { queues: [{ queue: 'ingestion', completed: 90, failed: 0, retried: 0 }] },
    });
  });

  it('evaluates in the past by the offset for a baseline comparison', async () => {
    const harness = new Harness();
    const result = await harness.executor.run({
      template: 'site_requests',
      offset_days: 7,
    });
    expect(harness.asked.every((call) => call.atMs === NOW_MS - 7 * DAY_MS)).toBe(true);
    expect(result).toMatchObject({ offsetDays: 7, evaluatedAtKyiv: '2026-11-15 14:00' });
  });

  it('rejects a parameter the template does not take, naming the problem', async () => {
    await expect(
      new Harness().executor.run({ template: 'backup_status', queue: 'ingestion' }),
    ).rejects.toThrow(/backup_status.*queue/);
  });

  it('rejects a window beyond 7 days without asking Prometheus', async () => {
    const harness = new Harness();
    await expect(
      harness.executor.run({ template: 'site_requests', window: '30d' }),
    ).rejects.toThrow(/window/);
    expect(harness.asked).toEqual([]);
  });

  it('rejects a hostile label without asking Prometheus', async () => {
    const harness = new Harness();
    await expect(
      harness.executor.run({ template: 'queue_throughput', queue: 'x"} or vector(1) #' }),
    ).rejects.toThrow(/queue/);
    expect(harness.asked).toEqual([]);
  });

  it('caps the number of series it reads and says how many it left out', async () => {
    const harness = new Harness();
    harness.samples = (query) =>
      query.includes('result="completed"')
        ? Array.from({ length: METRIC_SERIES_CAP + 5 }, (_, index) => ({
            labels: { queue: `queue-${index}` },
            value: 1,
          }))
        : [];
    const result = materialized(await harness.executor.run({ template: 'queue_throughput' })) as {
      seriesOmitted: number;
      data: { queues: unknown[] };
    };
    expect(result.data.queues).toHaveLength(METRIC_SERIES_CAP);
    expect(result.seriesOmitted).toBe(5);
  });

  it('passes the job filter to the scheduler template', async () => {
    const harness = new Harness();
    harness.samples = (query) =>
      query.includes('next_run')
        ? [
            { labels: { job_name: 'scheduled-trending', schedule: '0 */4 * * *' }, value: 1 },
            {
              labels: { job_name: 'scheduled-upcoming-movies-refresh-all', schedule: '0 7 * * 1' },
              value: 1,
            },
          ]
        : [];
    const result = materialized(
      await harness.executor.run({ template: 'scheduler_last_runs', job: 'refresh-all' }),
    ) as { data: { jobs: { job: string }[] } };
    expect(result.data.jobs.map((row) => row.job)).toEqual([
      'scheduled-upcoming-movies-refresh-all',
    ]);
  });

  it('lets a Prometheus failure surface so the model sees the error', async () => {
    const harness = new Harness();
    harness.failure = new Error('Grafana недоступна');
    await expect(harness.executor.run({ template: 'site_requests' })).rejects.toThrow(
      'Grafana недоступна',
    );
  });

  describe('failures of the port', () => {
    it('logs the message of a failed query and lets the failure through', async () => {
      const harness = new Harness();
      harness.failure = new MetricsQueryError('Grafana відповіла HTTP 502');

      await expect(harness.executor.run({ template: 'infra_health' })).rejects.toBe(
        harness.failure,
      );

      expect(new Set(harness.logger.warnings)).toEqual(
        new Set(['metrics_query failed: Grafana відповіла HTTP 502']),
      );
    });

    it('logs the name of an error it does not know', async () => {
      const harness = new Harness();
      harness.failure = new TypeError('boom');

      await expect(harness.executor.run({ template: 'infra_health' })).rejects.toThrow('boom');

      expect(new Set(harness.logger.warnings)).toEqual(
        new Set(['metrics_query failed: TypeError']),
      );
    });

    it('does not warn that a tool is off when Grafana was never configured', async () => {
      const harness = new Harness();
      harness.failure = new MetricsNotConfiguredError();

      await expect(harness.executor.run({ template: 'infra_health' })).rejects.toThrow(
        'Grafana не налаштована',
      );

      expect(harness.logger.warnings).toEqual([]);
    });
  });
});
