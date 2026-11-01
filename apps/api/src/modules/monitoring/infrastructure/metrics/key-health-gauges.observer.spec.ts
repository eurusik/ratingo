import { metrics } from '@opentelemetry/api';

import {
  API_KEY_PROBE_LATENCY_METRIC,
  API_KEY_STATUS_METRIC,
} from '../../../../telemetry/telemetry.constants';
import { createTestMeterProvider } from '../../../../telemetry/telemetry.testing';
import { API_KEY_STATUS, type ApiKeyStatus } from '../../domain/constants/api-key-status.const';
import {
  MONITORED_PROVIDER,
  type MonitoredProvider,
} from '../../domain/constants/monitored-provider.const';
import { type KeyHealthSnapshot } from '../../domain/entities/key-health-snapshot.entity';
import { type KeyHealthRepository } from '../../domain/repositories/key-health.repository';

import { KeyHealthGaugesObserver } from './key-health-gauges.observer';

const snapshot = (
  provider: MonitoredProvider,
  status: ApiKeyStatus,
  latencyMs: number | null,
): KeyHealthSnapshot => ({
  provider,
  status,
  latencyMs,
  statusCode: null,
  detail: null,
  quotaRemaining: null,
  quotaLimit: null,
  checkedAt: new Date(0),
});

describe('KeyHealthGaugesObserver', () => {
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];
  let repository: jest.Mocked<KeyHealthRepository>;

  beforeEach(() => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    metrics.setGlobalMeterProvider(testProvider.provider);
    repository = {
      save: jest.fn(),
      findLatestPerProvider: jest
        .fn()
        .mockResolvedValue([
          snapshot(MONITORED_PROVIDER.TMDB, API_KEY_STATUS.VALID, 120),
          snapshot(MONITORED_PROVIDER.OMDB, API_KEY_STATUS.INVALID, 80),
          snapshot(MONITORED_PROVIDER.TRAKT, API_KEY_STATUS.DEGRADED, null),
          snapshot(MONITORED_PROVIDER.S3, API_KEY_STATUS.UNKNOWN, null),
        ]),
      findHistory: jest.fn(),
    };
  });

  afterEach(() => {
    metrics.disable();
  });

  it('reports the latest persisted status per provider', async () => {
    new KeyHealthGaugesObserver(repository).onModuleInit();

    await expect(collect(API_KEY_STATUS_METRIC)).resolves.toEqual(
      expect.arrayContaining([
        { value: 1, attributes: { provider: 'tmdb' } },
        { value: 0, attributes: { provider: 'omdb' } },
        { value: 0.5, attributes: { provider: 'trakt' } },
        { value: -1, attributes: { provider: 's3' } },
      ]),
    );
  });

  it('reports latency only for snapshots that measured it', async () => {
    new KeyHealthGaugesObserver(repository).onModuleInit();

    const points = await collect(API_KEY_PROBE_LATENCY_METRIC);

    expect(points).toHaveLength(2);
    expect(points).toEqual(
      expect.arrayContaining([
        { value: 120, attributes: { provider: 'tmdb' } },
        { value: 80, attributes: { provider: 'omdb' } },
      ]),
    );
  });

  it('reports nothing when the repository read fails', async () => {
    repository.findLatestPerProvider.mockRejectedValue(new Error('db down'));
    new KeyHealthGaugesObserver(repository).onModuleInit();

    await expect(collect(API_KEY_STATUS_METRIC)).resolves.toHaveLength(0);
  });

  it('stops observing after module destroy', async () => {
    const observer = new KeyHealthGaugesObserver(repository);
    observer.onModuleInit();
    observer.onModuleDestroy();

    await expect(collect(API_KEY_STATUS_METRIC)).resolves.toHaveLength(0);
  });
});
