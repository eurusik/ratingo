import { metrics } from '@opentelemetry/api';

import { QueueMetricsService } from './queue-metrics.service';
import { QUEUE_JOBS_METRIC, SCHEDULER_NEXT_RUN_METRIC } from './telemetry.constants';
import { createTestMeterProvider } from './telemetry.testing';

const noSchedulers = () => jest.fn().mockResolvedValue([]);

const fakeQueue = (
  name: string,
  getJobCounts: jest.Mock,
  getJobSchedulers: jest.Mock = noSchedulers(),
) => ({ name, getJobCounts, getJobSchedulers }) as any;

const MONDAY_0700_UTC_MS = Date.UTC(2026, 10, 30, 7, 0, 0);
const TOMORROW_0700_UTC_MS = Date.UTC(2026, 10, 27, 7, 0, 0);

const counts = (overrides: Record<string, number> = {}) => ({
  waiting: 0,
  active: 0,
  delayed: 0,
  failed: 0,
  prioritized: 0,
  ...overrides,
});

describe('QueueMetricsService', () => {
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];

  beforeEach(() => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    metrics.setGlobalMeterProvider(testProvider.provider);
  });

  afterEach(() => {
    metrics.disable();
  });

  const createService = (
    failing = jest.fn().mockRejectedValue(new Error('redis down')),
    ingestionSchedulers: jest.Mock = noSchedulers(),
    monitoringSchedulers: jest.Mock = noSchedulers(),
  ) => {
    const ingestion = jest.fn().mockResolvedValue(counts({ waiting: 3, active: 1 }));
    const others = jest.fn().mockResolvedValue(counts());
    const stats = jest.fn().mockResolvedValue(counts({ failed: 2 }));
    return new QueueMetricsService(
      fakeQueue('ingestion', ingestion, ingestionSchedulers),
      fakeQueue('backfill', others),
      fakeQueue('ratings-backfill', others),
      fakeQueue('catalog-policy-queue', failing, failing),
      fakeQueue('stats-queue', stats),
      fakeQueue('monitoring-queue', others, monitoringSchedulers),
      fakeQueue('user-notifications', others),
    );
  };

  it('reports job counts per queue and state', async () => {
    const service = createService();
    service.onModuleInit();

    const points = await collect(QUEUE_JOBS_METRIC);

    expect(points).toEqual(
      expect.arrayContaining([
        { value: 3, attributes: { queue: 'ingestion', state: 'waiting' } },
        { value: 1, attributes: { queue: 'ingestion', state: 'active' } },
        { value: 2, attributes: { queue: 'stats-queue', state: 'failed' } },
        { value: 0, attributes: { queue: 'backfill', state: 'delayed' } },
      ]),
    );
  });

  it('keeps reporting other queues when one queue fails to answer', async () => {
    const service = createService();
    service.onModuleInit();

    const points = await collect(QUEUE_JOBS_METRIC);
    const queues = new Set(points.map((point) => point.attributes.queue));

    expect(queues).toEqual(
      new Set([
        'ingestion',
        'backfill',
        'ratings-backfill',
        'stats-queue',
        'monitoring-queue',
        'user-notifications',
      ]),
    );
  });

  it('stops observing after module destroy', async () => {
    const service = createService();
    service.onModuleInit();
    service.onModuleDestroy();

    await expect(collect(QUEUE_JOBS_METRIC)).resolves.toHaveLength(0);
  });

  describe('scheduler next run', () => {
    it('reports the next run of each scheduled job with its schedule and timezone', async () => {
      const ingestionSchedulers = jest.fn().mockResolvedValue([
        {
          key: 'test:scheduled-upcoming-movies-refresh-all',
          name: 'refresh-upcoming-movies',
          pattern: '0 7 * * 1',
          tz: 'UTC',
          next: MONDAY_0700_UTC_MS,
        },
      ]);
      const monitoringSchedulers = jest.fn().mockResolvedValue([
        {
          key: 'test:scheduled-key-health',
          name: 'check-keys',
          every: 3_600_000,
          next: TOMORROW_0700_UTC_MS,
        },
      ]);
      const service = createService(undefined, ingestionSchedulers, monitoringSchedulers);
      service.onModuleInit();

      const points = await collect(SCHEDULER_NEXT_RUN_METRIC);

      expect(points).toEqual(
        expect.arrayContaining([
          {
            value: MONDAY_0700_UTC_MS / 1000,
            attributes: {
              job_name: 'scheduled-upcoming-movies-refresh-all',
              schedule: '0 7 * * 1',
              tz: 'UTC',
            },
          },
          {
            value: TOMORROW_0700_UTC_MS / 1000,
            attributes: { job_name: 'scheduled-key-health', schedule: 'every 3600s', tz: 'UTC' },
          },
        ]),
      );
      expect(points).toHaveLength(2);
    });

    it('skips schedulers of another environment, unknown jobs and schedulers without a next run', async () => {
      const ingestionSchedulers = jest.fn().mockResolvedValue([
        {
          key: 'prod:scheduled-upcoming-movies-refresh-all',
          name: 'refresh-upcoming-movies',
          pattern: '0 7 * * 1',
          next: MONDAY_0700_UTC_MS,
        },
        { key: 'test:some-adhoc-job', name: 'x', pattern: '* * * * *', next: MONDAY_0700_UTC_MS },
        { key: 'test:scheduled-upcoming-movies', name: 'sync', pattern: '0 5 * * *' },
      ]);
      const service = createService(undefined, ingestionSchedulers);
      service.onModuleInit();

      await expect(collect(SCHEDULER_NEXT_RUN_METRIC)).resolves.toHaveLength(0);
    });

    it('keeps reporting job counts when reading schedulers fails', async () => {
      const service = createService(
        undefined,
        jest.fn().mockRejectedValue(new Error('redis down')),
      );
      service.onModuleInit();

      const points = await collect(QUEUE_JOBS_METRIC);

      expect(points).toEqual(
        expect.arrayContaining([
          { value: 3, attributes: { queue: 'ingestion', state: 'waiting' } },
        ]),
      );
    });
  });
});
