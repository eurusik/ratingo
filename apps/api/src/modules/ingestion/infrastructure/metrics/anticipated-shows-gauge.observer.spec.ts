import { metrics } from '@opentelemetry/api';

import { TRAKT_ANTICIPATED_FETCHED_METRIC } from '@/telemetry/telemetry.constants';
import { createTestMeterProvider } from '@/telemetry/telemetry.testing';

import { AnticipatedShowsGaugeObserver } from './anticipated-shows-gauge.observer';

describe('AnticipatedShowsGaugeObserver', () => {
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];
  let repository: { findLatestFetchedAt: jest.Mock };

  const observer = () => new AnticipatedShowsGaugeObserver(repository as never);

  beforeEach(() => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    metrics.setGlobalMeterProvider(testProvider.provider);
    repository = {
      findLatestFetchedAt: jest.fn().mockResolvedValue(new Date('2026-11-20T05:30:00.750Z')),
    };
  });

  afterEach(() => {
    metrics.disable();
  });

  it('reports when the snapshot was fetched, in whole unix seconds', async () => {
    observer().onModuleInit();

    await expect(collect(TRAKT_ANTICIPATED_FETCHED_METRIC)).resolves.toEqual([
      { value: 1795152600, attributes: {} },
    ]);
  });

  it('reports nothing while there is no snapshot', async () => {
    repository.findLatestFetchedAt.mockResolvedValue(null);
    observer().onModuleInit();

    await expect(collect(TRAKT_ANTICIPATED_FETCHED_METRIC)).resolves.toHaveLength(0);
  });

  it('reports nothing when the repository read fails', async () => {
    repository.findLatestFetchedAt.mockRejectedValue(new Error('db down'));
    observer().onModuleInit();

    await expect(collect(TRAKT_ANTICIPATED_FETCHED_METRIC)).resolves.toHaveLength(0);
  });

  it('stops observing after module destroy', async () => {
    const instance = observer();
    instance.onModuleInit();
    instance.onModuleDestroy();

    await expect(collect(TRAKT_ANTICIPATED_FETCHED_METRIC)).resolves.toHaveLength(0);
  });
});
