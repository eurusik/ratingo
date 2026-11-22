import fc from 'fast-check';

import { DigestLevel } from '../constants/digest-level.constants';
import { DigestSource } from '../constants/digest-source.constants';
import {
  THRESHOLDS,
  greenSnapshot,
  healthyQueue,
  redSnapshot,
  unavailableSnapshot,
} from '../digest.testing';
import { measured } from '../entities/measured';
import { HttpErrorKind } from '../entities/snapshot';
import { available } from '../entities/source-reading';

import { evaluateDigest } from './evaluate-digest';
import { evaluateQueues } from './queues.rule';

const counts = fc.integer({ min: 0, max: 5000 });
const queueArb = fc.record({
  queue: fc.constantFrom('ingestion', 'stats-queue', 'ratings-backfill'),
  backlogNow: counts,
  backlogMax24h: fc.record({ current: counts, baseline: fc.option(counts, { nil: null }) }),
  completed24h: fc.record({ current: counts, baseline: fc.option(counts, { nil: null }) }),
  failed24h: fc.record({ current: counts, baseline: fc.option(counts, { nil: null }) }),
  retried24h: fc.record({ current: counts, baseline: fc.option(counts, { nil: null }) }),
  failedJobs: fc.constant<{ jobName: string; count: number }[]>([]),
});

describe('evaluateDigest', () => {
  it('reports a healthy snapshot as ok with no items', () => {
    const digest = evaluateDigest(greenSnapshot(), THRESHOLDS);
    expect(digest.level).toBe(DigestLevel.OK);
    expect(digest.blocks.flatMap((block) => block.items)).toEqual([]);
  });

  it('puts the people block before infrastructure', () => {
    const digest = evaluateDigest(redSnapshot(), THRESHOLDS);
    expect(digest.blocks.map((block) => block.block)).toEqual([
      'people',
      'jobs',
      'services',
      'storage',
    ]);
    expect(digest.level).toBe(DigestLevel.ACTION);
  });

  it('turns an invalid key into an action and a degraded key into a note', () => {
    const items = evaluateDigest(redSnapshot(), THRESHOLDS).blocks.flatMap((block) => block.items);
    expect(items.find((item) => item.id === 'api-key:TMDB')?.level).toBe(DigestLevel.ACTION);
    expect(items.find((item) => item.id === 'api-key:Trakt')?.level).toBe(DigestLevel.NOTE);
  });

  it('never alerts on 404s because they are not collected, and treats retried rate limits as notes', () => {
    const snapshot = {
      ...greenSnapshot(),
      httpErrors: available([
        { server: 'api.trakt.tv', kind: HttpErrorKind.RATE_LIMIT, count: measured(54, 40) },
      ]),
    };
    const items = evaluateDigest(snapshot, THRESHOLDS).blocks.flatMap((block) => block.items);
    expect(items).toHaveLength(1);
    expect(items[0]?.level).toBe(DigestLevel.NOTE);
  });

  it('escalates heavy rate limiting and any auth failure to an action', () => {
    const snapshot = {
      ...greenSnapshot(),
      httpErrors: available([
        { server: 'api.trakt.tv', kind: HttpErrorKind.RATE_LIMIT, count: measured(900, 10) },
        { server: 'api.themoviedb.org', kind: HttpErrorKind.AUTH, count: measured(1, 0) },
      ]),
    };
    const levels = evaluateDigest(snapshot, THRESHOLDS)
      .blocks.flatMap((block) => block.items)
      .map((item) => item.level);
    expect(levels).toEqual([DigestLevel.ACTION, DigestLevel.ACTION]);
  });

  it('shows missing sources once and never as zero numbers', () => {
    const digest = evaluateDigest(unavailableSnapshot(), THRESHOLDS);
    const missing = digest.blocks
      .flatMap((block) => block.items)
      .filter((i) => i.id === 'sources-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.advice).toContain('черги');
    expect(missing[0]?.advice).not.toContain('нічні завдання');
    const unavailableSources = digest.sources
      .filter((s) => s.state === 'unavailable')
      .map((s) => s.source);
    expect(unavailableSources).toEqual(
      expect.arrayContaining([DigestSource.QUEUES, DigestSource.SCHEDULER, DigestSource.PRODUCT]),
    );
    expect(digest.blocks.find((block) => block.block === 'people')?.facts).toEqual([]);
  });

  it('flags a stopped backup, a failed backup and a down database', () => {
    const snapshot = {
      ...greenSnapshot(),
      backup: available({ lastRunAgeHours: 50, lastResult: 'success' as const, sizeBytes: null }),
      infra: available({ databaseUp: false, redisUp: true, redisMemoryUsedRatio: 0.9 }),
    };
    const ids = evaluateDigest(snapshot, THRESHOLDS)
      .blocks.flatMap((block) => block.items)
      .map((item) => item.id);
    expect(ids).toEqual(
      expect.arrayContaining(['backup-stale', 'infra-database-down', 'infra-redis-memory']),
    );
  });

  it('flags a failing nightly job as an action and a stale one as a note', () => {
    const snapshot = {
      ...greenSnapshot(),
      scheduler: available([
        { jobName: 'a', lastSuccessAgeHours: 30, lastFailureAgeHours: 2 },
        { jobName: 'b', lastSuccessAgeHours: 80, lastFailureAgeHours: null },
        { jobName: 'c', lastSuccessAgeHours: null, lastFailureAgeHours: 1 },
      ]),
    };
    const byId = Object.fromEntries(
      evaluateDigest(snapshot, THRESHOLDS)
        .blocks.flatMap((block) => block.items)
        .map((item) => [item.id, item.level]),
    );
    expect(byId).toEqual({
      'scheduler-failing:a': DigestLevel.ACTION,
      'scheduler-stale:b': DigestLevel.NOTE,
      'scheduler-failing:c': DigestLevel.ACTION,
    });
  });

  it('raises signups stopped only when there was a real baseline', () => {
    const quiet = {
      ...greenSnapshot(),
      product: available({ newUsers: measured(0, 2), actions: measured(5, 6) }),
    };
    const busy = {
      ...greenSnapshot(),
      product: available({ newUsers: measured(0, 15), actions: measured(5, 6) }),
    };
    expect(evaluateDigest(quiet, THRESHOLDS).level).toBe(DigestLevel.OK);
    expect(evaluateDigest(busy, THRESHOLDS).level).toBe(DigestLevel.ACTION);
  });

  it('keeps the digest level equal to the worst item for any queue state', () => {
    fc.assert(
      fc.property(fc.array(queueArb, { minLength: 1, maxLength: 4 }), (queues) => {
        const digest = evaluateDigest(
          { ...greenSnapshot(), queues: available(queues) },
          THRESHOLDS,
        );
        const levels = digest.blocks.flatMap((block) => block.items).map((item) => item.level);
        const expected = levels.includes(DigestLevel.ACTION)
          ? DigestLevel.ACTION
          : levels.includes(DigestLevel.NOTE)
            ? DigestLevel.NOTE
            : DigestLevel.OK;
        expect(digest.level).toBe(expected);
      }),
    );
  });
});

describe('evaluateQueues', () => {
  it('never reports a queue failure when nothing failed and nothing is stuck', () => {
    fc.assert(
      fc.property(counts, counts, (completed, backlogMax) => {
        const queue = {
          ...healthyQueue(),
          completed24h: measured(Math.max(completed, 1200)),
          backlogMax24h: measured(backlogMax),
          failed24h: measured(0),
          retried24h: measured(0),
          backlogNow: 10,
        };
        expect(evaluateQueues([queue], THRESHOLDS).items).toEqual([]);
      }),
    );
  });

  it('never goes above a note for backfill queues that are slow by design', () => {
    fc.assert(
      fc.property(fc.integer({ min: 50, max: 100000 }), counts, (backlogNow, completed) => {
        const queue = {
          ...healthyQueue('ratings-backfill'),
          backlogNow,
          completed24h: measured(completed),
        };
        const levels = evaluateQueues([queue], THRESHOLDS).items.map((item) => item.level);
        expect(levels).not.toContain(DigestLevel.ACTION);
      }),
    );
  });

  it('escalates when jobs fail often and the queue is stalled', () => {
    const failing = {
      ...healthyQueue(),
      failed24h: measured(80),
      completed24h: measured(100),
    };
    const stalled = { ...healthyQueue('stats-queue'), backlogNow: 500, completed24h: measured(0) };
    const items = evaluateQueues([failing, stalled], THRESHOLDS).items;
    expect(items.map((item) => item.id).sort()).toEqual([
      'queue-drain:stats-queue',
      'queue-failures:ingestion',
    ]);
    expect(items.every((item) => item.level === DigestLevel.ACTION)).toBe(true);
  });

  it('never uses the failed-kept gauge as a failure signal, only completed-job counts', () => {
    const queue = { ...healthyQueue(), failed24h: measured(0), backlogNow: 4 };
    expect(evaluateQueues([queue], THRESHOLDS).items).toEqual([]);
  });
});
