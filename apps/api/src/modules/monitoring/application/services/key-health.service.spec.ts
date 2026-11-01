import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import {
  MONITORED_PROVIDER,
  MONITORED_PROVIDERS,
} from '../../domain/constants/monitored-provider.const';
import { type KeyHealthSnapshot } from '../../domain/entities/key-health-snapshot.entity';
import { type FailureCounterStore } from '../../domain/ports/failure-counter-store.port';
import { type KeyHealthMetricsPort } from '../../domain/ports/key-health-metrics.port';
import { type KeyProbe } from '../../domain/ports/key-probe.port';
import { type RunLock } from '../../domain/ports/run-lock.port';
import { type KeyHealthRepository } from '../../domain/repositories/key-health.repository';

import { KeyHealthService } from './key-health.service';

function makeProbe(
  provider: KeyProbe['provider'],
  result: Awaited<ReturnType<KeyProbe['probe']>>,
): KeyProbe {
  return { provider, probe: jest.fn().mockResolvedValue(result) };
}

describe('KeyHealthService', () => {
  let repository: jest.Mocked<KeyHealthRepository>;
  let failures: jest.Mocked<FailureCounterStore>;
  let runLock: RunLock;
  let metrics: jest.Mocked<Pick<KeyHealthMetricsPort, 'recordFailure'>>;

  function build(probes: KeyProbe[]): KeyHealthService {
    return new KeyHealthService(
      probes,
      repository,
      failures,
      runLock,
      metrics as unknown as KeyHealthMetricsPort,
    );
  }

  beforeEach(() => {
    repository = {
      save: jest.fn().mockResolvedValue(undefined),
      findLatestPerProvider: jest.fn().mockResolvedValue([]),
      findHistory: jest.fn().mockResolvedValue([]),
    };
    failures = {
      increment: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({ unauthorized: 0, rateLimited: 0 }),
    };
    runLock = { withLock: jest.fn((fn) => fn()) };
    metrics = { recordFailure: jest.fn() };
  });

  describe('runChecks', () => {
    it('persists one snapshot per probe with mapped fields', async () => {
      const probes = [
        makeProbe(MONITORED_PROVIDER.TMDB, { status: API_KEY_STATUS.VALID, latencyMs: 42 }),
        makeProbe(MONITORED_PROVIDER.OMDB, {
          status: API_KEY_STATUS.INVALID,
          statusCode: 401,
          detail: 'bad key',
        }),
      ];

      await build(probes).runChecks();

      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: MONITORED_PROVIDER.TMDB,
          status: API_KEY_STATUS.VALID,
          latencyMs: 42,
          statusCode: null,
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: MONITORED_PROVIDER.OMDB,
          status: API_KEY_STATUS.INVALID,
          statusCode: 401,
          detail: 'bad key',
        }),
      );
    });

    it('skips without persisting when the lock is held', async () => {
      runLock = { withLock: jest.fn().mockResolvedValue(null) };
      const probe = makeProbe(MONITORED_PROVIDER.TMDB, { status: API_KEY_STATUS.VALID });

      await build([probe]).runChecks();

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('keeps recording other providers when one snapshot fails to persist', async () => {
      repository.save.mockImplementation(async (snapshot) => {
        if (snapshot.provider === MONITORED_PROVIDER.OMDB) {
          throw new Error('db down');
        }
      });
      const probes = [
        makeProbe(MONITORED_PROVIDER.OMDB, { status: API_KEY_STATUS.VALID }),
        makeProbe(MONITORED_PROVIDER.TMDB, { status: API_KEY_STATUS.VALID }),
      ];

      await expect(build(probes).runChecks()).resolves.toBeUndefined();

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ provider: MONITORED_PROVIDER.TMDB }),
      );
    });
  });

  describe('getDashboard', () => {
    it('returns a row per monitored provider, null latest when never probed', async () => {
      const tmdbSnapshot: KeyHealthSnapshot = {
        provider: MONITORED_PROVIDER.TMDB,
        status: API_KEY_STATUS.VALID,
        statusCode: null,
        latencyMs: 10,
        detail: null,
        quotaRemaining: null,
        quotaLimit: null,
        checkedAt: new Date(),
      };
      repository.findLatestPerProvider.mockResolvedValue([tmdbSnapshot]);
      failures.get.mockResolvedValue({ unauthorized: 2, rateLimited: 1 });

      const dashboard = await build([]).getDashboard();

      expect(dashboard).toHaveLength(MONITORED_PROVIDERS.length);
      const tmdbRow = dashboard.find((r) => r.provider === MONITORED_PROVIDER.TMDB);
      expect(tmdbRow?.latest).toEqual(tmdbSnapshot);
      expect(tmdbRow?.failures).toEqual({ unauthorized: 2, rateLimited: 1 });
      const s3Row = dashboard.find((r) => r.provider === MONITORED_PROVIDER.S3);
      expect(s3Row?.latest).toBeNull();
    });
  });

  describe('recordFailure', () => {
    it('increments counter and metrics for a monitored provider', async () => {
      await build([]).recordFailure(MONITORED_PROVIDER.TRAKT, 429);
      expect(failures.increment).toHaveBeenCalledWith(MONITORED_PROVIDER.TRAKT, 429);
      expect(metrics.recordFailure).toHaveBeenCalledWith(MONITORED_PROVIDER.TRAKT, 429);
    });

    it('ignores providers that are not monitored', async () => {
      await build([]).recordFailure('totally-unknown', 401);
      expect(failures.increment).not.toHaveBeenCalled();
      expect(metrics.recordFailure).not.toHaveBeenCalled();
    });
  });
});
