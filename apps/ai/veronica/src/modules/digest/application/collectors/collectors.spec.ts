import { NOW_MS } from '../../testing/digest.testing';
import type { MetricSample, MetricsPort } from '../../domain/ports/metrics.port';

import { ApiKeysCollector } from './api-keys.collector';
import { BackupCollector } from './backup.collector';
import { HttpErrorsCollector } from './http-errors.collector';
import { InfraCollector } from './infra.collector';
import { QueuesCollector } from './queues.collector';
import { SchedulerCollector } from './scheduler.collector';

type Responder = (query: string, atMs: number) => MetricSample[];

const metricsWith = (respond: Responder): MetricsPort => ({
  instant: async (query, atMs) => respond(query, atMs),
});

const sample = (labels: Record<string, string>, value: number): MetricSample => ({ labels, value });
const SEC = (ms: number) => ms / 1000;
const HOUR_MS = 3_600_000;

describe('QueuesCollector', () => {
  it('uses max over 24h, completed counts and never the failed gauge state', async () => {
    const queries: string[] = [];
    const collector = new QueuesCollector(
      metricsWith((query, atMs) => {
        queries.push(query);
        const old = atMs < NOW_MS;
        if (query.includes('max_over_time'))
          return [sample({ queue: 'ingestion' }, old ? 100 : 400)];
        if (query.includes('result="completed"'))
          return [sample({ queue: 'ingestion' }, old ? 900 : 1000)];
        if (query.includes('result="failed"') && query.includes('job_name'))
          return [sample({ queue: 'ingestion', job_name: 'sync-show' }, 7.4)];
        if (query.includes('result="failed"'))
          return [sample({ queue: 'ingestion' }, old ? 0 : 7.4)];
        if (query.includes('app_queue_jobs')) return [sample({ queue: 'ingestion' }, 12)];
        return [];
      }),
    );
    const reading = await collector.collect(NOW_MS);
    expect(reading.state).toBe('ok');
    if (reading.state !== 'ok') return;
    expect(reading.data).toEqual([
      {
        queue: 'ingestion',
        backlogNow: 12,
        backlogMax24h: { current: 400, baseline: 100 },
        completed24h: { current: 1000, baseline: 900 },
        failed24h: { current: 7, baseline: 0 },
        retried24h: { current: 0, baseline: 0 },
        failedJobs: [{ jobName: 'sync-show', count: 7 }],
      },
    ]);
    expect(queries.some((query) => /state=~"[^"]*failed/.test(query))).toBe(false);
  });

  it('keeps the peak per queue and leaves a missing backlog empty instead of zero', async () => {
    const collector = new QueuesCollector(
      metricsWith((query) => {
        if (query.includes('max_over_time')) {
          return [sample({ queue: 'ingestion' }, 391), sample({ queue: 'ratings-backfill' }, 174)];
        }
        if (query.includes('result="completed"')) {
          return [
            sample({ queue: 'ingestion' }, 10),
            sample({ queue: 'ratings-backfill' }, 10),
            sample({ queue: 'stats-queue' }, 10),
          ];
        }
        return [];
      }),
    );
    const reading = await collector.collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data.map((q) => q.backlogMax24h)).toEqual([
      { current: 391, baseline: 391 },
      { current: 174, baseline: 174 },
      null,
    ]);
    expect(reading.state === 'ok' && reading.data.map((q) => q.backlogNow)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('is unavailable when there are no queue metrics at all', async () => {
    const reading = await new QueuesCollector(metricsWith(() => [])).collect(NOW_MS);
    expect(reading).toEqual({ state: 'unavailable', reason: 'метрик черг немає' });
  });

  it('is unavailable with a reason when the metrics source throws', async () => {
    const collector = new QueuesCollector({
      instant: async () => {
        throw new Error('Grafana відповіла HTTP 401');
      },
    });
    const reading = await collector.collect(NOW_MS);
    expect(reading).toMatchObject({ state: 'unavailable' });
    expect(JSON.stringify(reading)).toContain('HTTP 401');
  });
});

describe('ApiKeysCollector', () => {
  it('maps gauge values to key states', async () => {
    const reading = await new ApiKeysCollector(
      metricsWith(() => [
        sample({ provider: 'TMDB' }, 1),
        sample({ provider: 'Trakt' }, 0.5),
        sample({ provider: 'MDBList' }, 0),
        sample({ provider: 'S3' }, -1),
      ]),
    ).collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data.map((key) => [key.provider, key.state])).toEqual([
      ['MDBList', 'invalid'],
      ['S3', 'unknown'],
      ['TMDB', 'valid'],
      ['Trakt', 'degraded'],
    ]);
  });
});

describe('HttpErrorsCollector', () => {
  it('keeps only 401, 403 and 429 and groups them by server and kind', async () => {
    const collector = new HttpErrorsCollector(
      metricsWith((query, atMs) => {
        if (query.startsWith('sum(increase')) return [sample({}, 5000)];
        const old = atMs < NOW_MS;
        return [
          sample(
            { server_address: 'api.trakt.tv', http_response_status_code: '429' },
            old ? 10 : 54.4,
          ),
          sample(
            { server_address: 'api.themoviedb.org', http_response_status_code: '401' },
            old ? 0 : 2,
          ),
          sample(
            { server_address: 'api.themoviedb.org', http_response_status_code: '403' },
            old ? 0 : 1,
          ),
          sample({ server_address: 'api.tvmaze.com', http_response_status_code: '404' }, 900),
        ];
      }),
    );
    const reading = await collector.collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data).toEqual([
      { server: 'api.themoviedb.org', kind: 'auth', count: { current: 3, baseline: 0 } },
      { server: 'api.trakt.tv', kind: 'rate_limit', count: { current: 54, baseline: 10 } },
    ]);
  });

  it('leaves the baseline unknown instead of zero when last week had no request metrics', async () => {
    const collector = new HttpErrorsCollector(
      metricsWith((query, atMs) => {
        if (atMs < NOW_MS) return [];
        if (query.startsWith('sum(increase')) return [sample({}, 5000)];
        return [sample({ server_address: 'api.trakt.tv', http_response_status_code: '429' }, 3)];
      }),
    );
    const reading = await collector.collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data[0]?.count).toEqual({
      current: 3,
      baseline: null,
    });
  });

  it('is unavailable when no outgoing request metric exists, instead of reporting zero errors', async () => {
    const reading = await new HttpErrorsCollector(metricsWith(() => [])).collect(NOW_MS);
    expect(reading.state).toBe('unavailable');
  });
});

describe('BackupCollector', () => {
  it('computes age from the newest run and carries the result', async () => {
    const reading = await new BackupCollector(
      metricsWith((query) =>
        query.includes('timestamp')
          ? [
              sample({ result: 'success' }, SEC(NOW_MS - 30 * HOUR_MS)),
              sample({ result: 'failure' }, SEC(NOW_MS - 2 * HOUR_MS)),
            ]
          : [sample({}, 1000)],
      ),
    ).collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data.lastResult).toBe('failure');
    expect(reading.state === 'ok' && Math.round(reading.data.lastRunAgeHours ?? -1)).toBe(2);
  });

  it('is unavailable without backup metrics', async () => {
    expect((await new BackupCollector(metricsWith(() => [])).collect(NOW_MS)).state).toBe(
      'unavailable',
    );
  });
});

describe('InfraCollector', () => {
  const infraMetrics = (memory: { used?: number; max?: number }) =>
    metricsWith((query) => {
      if (query.includes('pg_up')) return [sample({}, 1)];
      if (query.includes('redis_up')) return [sample({}, 0)];
      if (query.includes('redis_memory_used_bytes')) {
        return memory.used === undefined ? [] : [sample({}, memory.used)];
      }
      return memory.max === undefined ? [] : [sample({}, memory.max)];
    });

  it('reads database and redis health and both memory figures', async () => {
    const reading = await new InfraCollector(infraMetrics({ used: 400, max: 1000 })).collect(
      NOW_MS,
    );
    expect(reading.state === 'ok' && reading.data).toEqual({
      databaseUp: true,
      redisUp: false,
      redisMemoryUsedBytes: 400,
      redisMemoryMaxBytes: 1000,
    });
  });

  it('keeps the used memory and leaves the maximum empty when redis has no maxmemory', async () => {
    const reading = await new InfraCollector(infraMetrics({ used: 9_500_000 })).collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data).toMatchObject({
      redisMemoryUsedBytes: 9_500_000,
      redisMemoryMaxBytes: null,
    });
  });

  it('leaves both memory figures empty instead of zero when redis exports none', async () => {
    const reading = await new InfraCollector(infraMetrics({})).collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data).toMatchObject({
      redisMemoryUsedBytes: null,
      redisMemoryMaxBytes: null,
    });
  });
});

describe('SchedulerCollector', () => {
  it('is unavailable until the api exports the gauge', async () => {
    const reading = await new SchedulerCollector(metricsWith(() => [])).collect(NOW_MS);
    expect(reading).toMatchObject({ state: 'unavailable' });
  });

  it('groups last success and failure per job', async () => {
    const reading = await new SchedulerCollector(
      metricsWith(() => [
        sample({ job_name: 'sync-trending', result: 'success' }, SEC(NOW_MS - 5 * HOUR_MS)),
        sample({ job_name: 'sync-trending', result: 'failure' }, SEC(NOW_MS - 20 * HOUR_MS)),
      ]),
    ).collect(NOW_MS);
    expect(reading.state === 'ok' && reading.data).toEqual([
      { jobName: 'sync-trending', lastSuccessAgeHours: 5, lastFailureAgeHours: 20 },
    ]);
  });
});
