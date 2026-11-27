import * as fc from 'fast-check';

import { RowList } from '@ratingo/ai-core';

import { MetricTemplateName } from './metrics.constants';

import { METRIC_TEMPLATES, type QueryResult } from './metric-templates';

const template = (name: MetricTemplateName) => METRIC_TEMPLATES[name];

const parse = (name: MetricTemplateName, params: Record<string, unknown>) =>
  template(name).params.safeParse(params);

const present = (
  name: MetricTemplateName,
  results: readonly QueryResult[],
  nowMs: number,
  params: Record<string, unknown> = {},
) => {
  const reading = template(name).present(results, nowMs, params);
  return 'data' in reading && reading.data instanceof RowList
    ? { data: reading.data.withAllRows() }
    : reading;
};

const sample = (name: string, value: number, labels: Record<string, string> = {}) => ({
  name,
  samples: [{ labels, value }],
});

describe('metric templates: parameters', () => {
  it('has a template for every name and no free-form query', () => {
    expect(Object.keys(METRIC_TEMPLATES).sort()).toEqual(Object.values(MetricTemplateName).sort());
  });

  it('defaults a windowed template to 24h and no offset', () => {
    expect(parse(MetricTemplateName.SITE_REQUESTS, {}).data).toEqual({
      window: '24h',
      offset_days: 0,
    });
  });

  it.each([
    [MetricTemplateName.SCHEDULER_LAST_RUNS, { window: '24h' }],
    [MetricTemplateName.BACKUP_STATUS, { queue: 'ingestion' }],
    [MetricTemplateName.SITE_REQUESTS, { queue: 'ingestion' }],
    [MetricTemplateName.QUEUE_THROUGHPUT, { provider: 'api.trakt.tv' }],
    [MetricTemplateName.HTTP_CLIENT_ERRORS, { queue: 'ingestion' }],
  ])('rejects a parameter the %s template does not take', (name, params) => {
    expect(parse(name, params).success).toBe(false);
  });

  it('rejects a window longer than 7 days and an offset beyond 14', () => {
    expect(parse(MetricTemplateName.SITE_REQUESTS, { window: '8d' }).success).toBe(false);
    expect(parse(MetricTemplateName.SITE_REQUESTS, { offset_days: 15 }).success).toBe(false);
    expect(parse(MetricTemplateName.SITE_REQUESTS, { offset_days: -1 }).success).toBe(false);
    expect(parse(MetricTemplateName.SITE_REQUESTS, { offset_days: 1.5 }).success).toBe(false);
  });

  it('accepts every window from 1 hour to 7 days and every offset up to 14 days', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 168 }),
        fc.integer({ min: 0, max: 14 }),
        (hours, offset) => {
          expect(
            parse(MetricTemplateName.SITE_REQUESTS, { window: `${hours}h`, offset_days: offset })
              .success,
          ).toBe(true);
        },
      ),
    );
  });

  it('rejects any window outside the allowed range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 169, max: 999 }), (hours) => {
        expect(parse(MetricTemplateName.SITE_REQUESTS, { window: `${hours}h` }).success).toBe(
          false,
        );
      }),
    );
  });

  it('never lets a string with PromQL metacharacters into a query', () => {
    const hostile = fc
      .tuple(fc.string(), fc.constantFrom('"', '}', '{', ')', '\\', ',', '`', '=~'), fc.string())
      .map(([before, bad, after]) => `${before}${bad}${after}`);
    fc.assert(
      fc.property(hostile, (value) => {
        expect(parse(MetricTemplateName.QUEUE_THROUGHPUT, { queue: value }).success).toBe(false);
        expect(parse(MetricTemplateName.QUEUE_BACKLOG_PEAK, { queue: value }).success).toBe(false);
        expect(parse(MetricTemplateName.HTTP_CLIENT_ERRORS, { provider: value }).success).toBe(
          false,
        );
        expect(parse(MetricTemplateName.HTTP_CLIENT_ERRORS, { status: value }).success).toBe(false);
        expect(parse(MetricTemplateName.SITE_REQUESTS, { window: value }).success).toBe(false);
      }),
    );
  });

  it('puts every accepted parameter into the query exactly once', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        fc.integer({ min: 1, max: 168 }),
        (queue, hours) => {
          const params = parse(MetricTemplateName.QUEUE_THROUGHPUT, {
            queue,
            window: `${hours}h`,
          }).data as Record<string, unknown>;
          const queries = template(MetricTemplateName.QUEUE_THROUGHPUT).queries(params);
          expect(queries).toHaveLength(3);
          for (const query of queries) {
            expect(query.promql.split(`queue="${queue}"`)).toHaveLength(2);
            expect(query.promql).toContain(`[${hours}h]`);
          }
        },
      ),
    );
  });
});

describe('metric templates: presentation', () => {
  it('shows queue throughput as whole numbers per queue', () => {
    const reading = present(
      MetricTemplateName.QUEUE_THROUGHPUT,
      [
        sample('completed', 1200.4, { queue: 'ingestion' }),
        sample('failed', 6.6, { queue: 'ingestion' }),
        { name: 'retried', samples: [] },
      ],
      0,
    );
    expect(reading).toEqual({
      data: { queues: [{ queue: 'ingestion', completed: 1200, failed: 7, retried: 0 }] },
    });
  });

  it('says there is no data instead of showing zero when a query returns nothing', () => {
    for (const name of Object.values(MetricTemplateName)) {
      expect(present(name, [], 0)).toEqual({ unavailable: expect.any(String) });
    }
  });

  it('keeps an unknown backlog empty rather than zero', () => {
    const reading = present(
      MetricTemplateName.QUEUE_BACKLOG_PEAK,
      [sample('peak', 40, { queue: 'ingestion' })],
      0,
    );
    expect(reading).toEqual({
      data: { queues: [{ queue: 'ingestion', waitingNow: null, peakInWindow: 40 }] },
    });
  });

  describe('scheduler_last_runs', () => {
    const nowMs = Date.UTC(2026, 10, 26, 12, 13);
    const secondsAt = (ms: number) => ms / 1000;

    it('joins last runs with the schedule and next run of each job', () => {
      const reading = present(
        MetricTemplateName.SCHEDULER_LAST_RUNS,
        [
          {
            name: 'runs',
            samples: [
              {
                labels: { job_name: 'scheduled-upcoming-movies-refresh-all', result: 'success' },
                value: secondsAt(Date.UTC(2026, 10, 23, 7, 0)),
              },
            ],
          },
          {
            name: 'next',
            samples: [
              {
                labels: {
                  job_name: 'scheduled-upcoming-movies-refresh-all',
                  schedule: '0 7 * * 1',
                  tz: 'UTC',
                },
                value: secondsAt(Date.UTC(2026, 10, 30, 7, 0)),
              },
              {
                labels: { job_name: 'scheduled-key-health', schedule: '0 * * * *', tz: 'UTC' },
                value: secondsAt(Date.UTC(2026, 10, 26, 13, 0)),
              },
            ],
          },
        ],
        nowMs,
      );
      expect(reading).toEqual({
        data: {
          jobs: [
            {
              job: 'scheduled-key-health',
              cadence: 'every hour',
              nextRunAtKyiv: '2026-11-26 15:00',
            },
            {
              job: 'scheduled-upcoming-movies-refresh-all',
              cadence: 'weekly on Monday',
              lastSuccessAtKyiv: '2026-11-23 09:00',
              lastSuccessHoursAgo: 77.22,
              nextRunAtKyiv: '2026-11-30 09:00',
            },
          ],
        },
      });
    });

    it('marks a job that ran but has no scheduler as not scheduled', () => {
      const reading = present(
        MetricTemplateName.SCHEDULER_LAST_RUNS,
        [
          {
            name: 'runs',
            samples: [
              {
                labels: { job_name: 'sync-trending', result: 'failure' },
                value: secondsAt(nowMs - 5 * 3_600_000),
              },
            ],
          },
          {
            name: 'next',
            samples: [
              {
                labels: { job_name: 'sync-show', schedule: '0 3 * * *', tz: 'UTC' },
                value: secondsAt(nowMs + 3_600_000),
              },
            ],
          },
        ],
        nowMs,
      );
      expect(reading).toMatchObject({
        data: {
          jobs: [
            { job: 'sync-show', cadence: 'daily' },
            { job: 'sync-trending', scheduled: false, lastFailureHoursAgo: 5 },
          ],
        },
      });
    });

    it('says the schedules are unknown instead of calling every job unscheduled', () => {
      const reading = present(
        MetricTemplateName.SCHEDULER_LAST_RUNS,
        [
          sample('runs', secondsAt(nowMs - 5 * 3_600_000), {
            job_name: 'sync-trending',
            result: 'success',
          }),
        ],
        nowMs,
      );
      expect(reading).toEqual({
        data: {
          jobs: [
            {
              job: 'sync-trending',
              lastSuccessAtKyiv: '2026-11-26 09:13',
              lastSuccessHoursAgo: 5,
            },
          ],
          schedules: 'метрик за цей запит немає',
        },
      });
    });
  });

  it('converts bytes to megabytes and seconds to milliseconds', () => {
    expect(
      present(MetricTemplateName.SITE_MEMORY_PEAK, [sample('rss', 250 * 1024 * 1024)], 0),
    ).toEqual({ data: { peakMemoryMb: 250 } });
    expect(present(MetricTemplateName.SITE_LATENCY_P95, [sample('p95', 0.17)], 0)).toEqual({
      data: { p95Ms: 170 },
    });
  });

  it('lists only the provider errors that happened, with the total beside them', () => {
    const reading = present(
      MetricTemplateName.HTTP_CLIENT_ERRORS,
      [
        sample('total', 5000),
        {
          name: 'errors',
          samples: [
            {
              labels: { server_address: 'api.trakt.tv', http_response_status_code: '429' },
              value: 12,
            },
            {
              labels: { server_address: 'api.tmdb.org', http_response_status_code: '401' },
              value: 0,
            },
          ],
        },
      ],
      0,
    );
    expect(reading).toEqual({
      data: {
        totalOutgoingRequests: 5000,
        errors: [{ provider: 'api.trakt.tv', status: '429', count: 12 }],
      },
    });
  });

  it('reports the database and Redis as up or down', () => {
    expect(
      present(
        MetricTemplateName.INFRA_HEALTH,
        [sample('database', 1), sample('redis', 0), sample('redisMemory', 9.5 * 1024 * 1024)],
        0,
      ),
    ).toEqual({ data: { databaseUp: true, redisUp: false, redisMemoryMb: 9.5 } });
  });
});
