import { DIGEST_THRESHOLDS } from '../../../config/digest.config';

import { measured } from './entities/measured';
import type { QueueStats, Snapshot } from './entities/snapshot';
import { ApiKeyState, BackupResult } from './entities/snapshot';
import { available, unavailable } from './entities/source-reading';

export const THRESHOLDS = DIGEST_THRESHOLDS;
export const NOW_MS = Date.UTC(2026, 10, 22, 6, 0, 0);

export const healthyQueue = (queue = 'ingestion'): QueueStats => ({
  queue,
  backlogNow: 3,
  backlogMax24h: measured(40, 38),
  completed24h: measured(1200, 1100),
  failed24h: measured(0, 0),
  retried24h: measured(2, 1),
  failedJobs: [],
});

export const greenSnapshot = (): Snapshot => ({
  date: '2026-11-22',
  generatedAtMs: NOW_MS,
  product: available({ newUsers: measured(14, 12), actions: measured(820, 790) }),
  queues: available([healthyQueue('ingestion'), healthyQueue('stats-queue')]),
  apiKeys: available([
    { provider: 'TMDB', state: ApiKeyState.VALID },
    { provider: 'Trakt', state: ApiKeyState.VALID },
  ]),
  httpErrors: available([]),
  backup: available({
    lastRunAgeHours: 6,
    lastResult: BackupResult.SUCCESS,
    sizeBytes: measured(512 * 1024 * 1024, 500 * 1024 * 1024),
  }),
  infra: available({ databaseUp: true, redisUp: true, redisMemoryUsedRatio: 0.2 }),
  scheduler: available([
    { jobName: 'sync-trending', lastSuccessAgeHours: 5, lastFailureAgeHours: null },
  ]),
});

export const redSnapshot = (): Snapshot => ({
  ...greenSnapshot(),
  apiKeys: available([
    { provider: 'TMDB', state: ApiKeyState.INVALID },
    { provider: 'Trakt', state: ApiKeyState.DEGRADED },
  ]),
  queues: available([
    {
      ...healthyQueue('ingestion'),
      failed24h: measured(60, 2),
      completed24h: measured(300, 1100),
      failedJobs: [{ jobName: 'sync-show', count: 55 }],
    },
  ]),
  product: available({ newUsers: measured(0, 14), actions: measured(300, 800) }),
});

export const unavailableSnapshot = (): Snapshot => ({
  ...greenSnapshot(),
  queues: unavailable('Grafana недоступна'),
  scheduler: unavailable('метрики планувальника ще немає'),
  product: unavailable('звіти про людей ще не підключені'),
});
