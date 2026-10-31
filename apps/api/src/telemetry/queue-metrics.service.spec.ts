import { metrics } from '@opentelemetry/api';

import { QueueMetricsService } from './queue-metrics.service';
import { QUEUE_JOBS_METRIC } from './telemetry.constants';
import { createTestMeterProvider } from './telemetry.testing';

const fakeQueue = (name: string, getJobCounts: jest.Mock) => ({ name, getJobCounts }) as any;

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

  const createService = (failing = jest.fn().mockRejectedValue(new Error('redis down'))) => {
    const ingestion = jest.fn().mockResolvedValue(counts({ waiting: 3, active: 1 }));
    const others = jest.fn().mockResolvedValue(counts());
    const stats = jest.fn().mockResolvedValue(counts({ failed: 2 }));
    return new QueueMetricsService(
      fakeQueue('ingestion', ingestion),
      fakeQueue('backfill', others),
      fakeQueue('ratings-backfill', others),
      fakeQueue('catalog-policy-queue', failing),
      fakeQueue('stats-queue', stats),
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

    expect(queues).toEqual(new Set(['ingestion', 'backfill', 'ratings-backfill', 'stats-queue']));
  });

  it('stops observing after module destroy', async () => {
    const service = createService();
    service.onModuleInit();
    service.onModuleDestroy();

    await expect(collect(QUEUE_JOBS_METRIC)).resolves.toHaveLength(0);
  });
});
