import fc from 'fast-check';

import { DigestLevel } from '../constants/digest-level.constants';
import { DigestSource } from '../constants/digest-source.constants';
import {
  THRESHOLDS,
  greenSnapshot,
  healthyQueue,
  redSnapshot,
  unavailableSnapshot,
} from '../../testing/digest.testing';
import { measured } from '../entities/measured';
import { HttpErrorKind } from '../entities/snapshot';
import { available, unavailable } from '../entities/source-reading';

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

  it('stays green when retried rate limits fall against the week before', () => {
    const snapshot = {
      ...greenSnapshot(),
      httpErrors: available([
        { server: 'api.trakt.tv', kind: HttpErrorKind.RATE_LIMIT, count: measured(54, 72) },
      ]),
    };
    const digest = evaluateDigest(snapshot, THRESHOLDS);
    expect(digest.level).toBe(DigestLevel.OK);
    expect(digest.blocks.flatMap((block) => block.items)).toEqual([]);
  });

  it('gives a note when rate limits grow against the week before', () => {
    const snapshot = {
      ...greenSnapshot(),
      httpErrors: available([
        { server: 'api.trakt.tv', kind: HttpErrorKind.RATE_LIMIT, count: measured(80, 40) },
      ]),
    };
    const items = evaluateDigest(snapshot, THRESHOLDS).blocks.flatMap((block) => block.items);
    expect(items).toHaveLength(1);
    expect(items[0]?.level).toBe(DigestLevel.NOTE);
  });

  it('never gives a rate-limit note when the count does not exceed the baseline', () => {
    fc.assert(
      fc.property(counts, fc.integer({ min: 0, max: 499 }), (baseline, extra) => {
        const current = Math.min(baseline, extra);
        const snapshot = {
          ...greenSnapshot(),
          httpErrors: available([
            {
              server: 'api.trakt.tv',
              kind: HttpErrorKind.RATE_LIMIT,
              count: measured(current, baseline),
            },
          ]),
        };
        expect(evaluateDigest(snapshot, THRESHOLDS).level).toBe(DigestLevel.OK);
      }),
    );
  });

  it('stays quiet about small rate-limit counts and unknown baselines', () => {
    for (const count of [measured(15, 0), measured(300, null)]) {
      const snapshot = {
        ...greenSnapshot(),
        httpErrors: available([{ server: 'api.trakt.tv', kind: HttpErrorKind.RATE_LIMIT, count }]),
      };
      expect(evaluateDigest(snapshot, THRESHOLDS).level).toBe(DigestLevel.OK);
    }
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
      infra: available({
        databaseUp: false,
        redisUp: true,
        redisMemoryUsedBytes: 900,
        redisMemoryMaxBytes: 1000,
      }),
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

  it('turns a fully blind digest into an action instead of a calm note', () => {
    const blind = {
      ...greenSnapshot(),
      queues: unavailable<never>('x'),
      apiKeys: unavailable<never>('x'),
      httpErrors: unavailable<never>('x'),
      backup: unavailable<never>('x'),
      infra: unavailable<never>('x'),
    };
    const digest = evaluateDigest(blind as never, THRESHOLDS);
    expect(digest.level).toBe(DigestLevel.ACTION);
    expect(digest.blocks.flatMap((b) => b.items)[0]?.advice).toContain('сліпий');
  });
});

describe('largest queue', () => {
  const largestFact = (queues: Parameters<typeof evaluateQueues>[0]) =>
    evaluateQueues(queues, THRESHOLDS).facts.find((fact) =>
      fact.label.startsWith('найбільша черга'),
    );

  it('is the biggest single peak, never the sum of the peaks', () => {
    const queues = [
      { ...healthyQueue('ingestion'), backlogMax24h: measured(391, 380) },
      { ...healthyQueue('ratings-backfill'), backlogMax24h: measured(174, 170) },
      { ...healthyQueue('stats-queue'), backlogMax24h: measured(1, 1) },
    ];
    expect(largestFact(queues)).toEqual({
      label: 'найбільша черга (ingestion), пік',
      unit: 'count',
      current: 391,
      baseline: 380,
    });
  });

  it('equals the maximum of the peaks for any queues', () => {
    fc.assert(
      fc.property(fc.array(queueArb, { minLength: 1, maxLength: 6 }), (queues) => {
        const peaks = queues.map((queue) => queue.backlogMax24h.current);
        expect(largestFact(queues)?.current).toBe(Math.max(...peaks));
      }),
    );
  });

  it('is reported as missing, not zero, when no queue has a backlog reading', () => {
    const queues = [{ ...healthyQueue(), backlogMax24h: null, backlogNow: null }];
    expect(largestFact(queues)).toEqual({
      label: 'найбільша черга',
      unit: 'count',
      current: null,
      baseline: null,
    });
  });
});

describe('redis memory', () => {
  const infraFacts = (used: number | null, max: number | null) =>
    evaluateDigest(
      {
        ...greenSnapshot(),
        infra: available({
          databaseUp: true,
          redisUp: true,
          redisMemoryUsedBytes: used,
          redisMemoryMaxBytes: max,
        }),
      },
      THRESHOLDS,
    ).blocks.flatMap((block) => block.facts);

  it('shows megabytes and no percentage when redis has no limit', () => {
    const facts = infraFacts(9.5 * 1024 * 1024, null);
    expect(facts).toContainEqual({
      label: 'пам’ять Redis',
      unit: 'megabytes',
      current: 10,
      baseline: null,
    });
    expect(facts.some((fact) => fact.unit === 'percent')).toBe(false);
  });

  it('shows a percentage only when a limit exists', () => {
    const facts = infraFacts(500, 1000);
    expect(facts.find((fact) => fact.unit === 'percent')?.current).toBe(50);
  });

  it('never turns missing memory into a number', () => {
    const facts = infraFacts(null, null);
    expect(facts.find((fact) => fact.label === 'пам’ять Redis')?.current).toBeNull();
    expect(facts.some((fact) => fact.unit === 'percent')).toBe(false);
  });
});
