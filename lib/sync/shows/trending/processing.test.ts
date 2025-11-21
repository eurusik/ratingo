import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processShow, processShowsBatch, aggregateResults } from './processing';

describe('shows/trending/processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).processTrendingShow = vi.fn(async () => ({
      skipped: false,
      updated: 1,
      added: 0,
      ratingsUpdated: 1,
      bucketsUpserted: 1,
      snapshotsInserted: 1,
      snapshotsUnchanged: 0,
      snapshotsProcessed: 1,
    }));
  });

  it('processShow returns skipped when tmdbId missing', async () => {
    const options = {
      monthly: {},
      maxWatchers: 10000,
      tmdbDetailsCache: new Map(),
      tmdbTranslationCache: new Map(),
      tmdbProvidersCache: new Map(),
      tmdbExternalIdsCache: new Map(),
    } as any;
    const res = await processShow({ show: { ids: {} } } as any, options);
    expect(res.skipped).toBe(true);
    expect(res.error).toBe('Відсутній TMDB ID');
  });

  it('processShow uses caches and delegates to global processor', async () => {
    const options = {
      monthly: {},
      maxWatchers: 10000,
      tmdbDetailsCache: new Map([[1, { d: 1 }]]),
      tmdbTranslationCache: new Map([[1, { t: 1 }]]),
      tmdbProvidersCache: new Map([['1', [{ p: 1 }]]]),
      tmdbExternalIdsCache: new Map([[1, { e: 1 }]]),
    } as any;
    const showData = { show: { ids: { tmdb: 1 } } } as any;
    const res = await processShow(showData, options);
    expect((global as any).processTrendingShow).toHaveBeenCalledTimes(1);
    const [argShow, argMonthly, argMaxWatchers, argCaches] = vi.mocked(
      (global as any).processTrendingShow
    ).mock.calls[0];
    expect(argShow).toBe(showData);
    expect(argMonthly).toBe(options.monthly);
    expect(argMaxWatchers).toBe(10000);
    expect(argCaches.details).toEqual({ d: 1 });
    expect(argCaches.translation).toEqual({ t: 1 });
    expect(Array.isArray(argCaches.providers)).toBe(true);
    expect(argCaches.externalIds).toEqual({ e: 1 });
    expect(res.skipped).toBe(false);
  });

  it('processShowsBatch processes all with concurrency', async () => {
    const items = [
      { show: { ids: { tmdb: 1 } } },
      { show: { ids: { tmdb: 2 } } },
      { show: { ids: { tmdb: 3 } } },
    ];
    const options = {
      monthly: {},
      maxWatchers: 10000,
      tmdbDetailsCache: new Map(),
      tmdbTranslationCache: new Map(),
      tmdbProvidersCache: new Map(),
      tmdbExternalIdsCache: new Map(),
    } as any;
    const res = await processShowsBatch(items as any, options, 2);
    expect(res).toHaveLength(items.length);
    expect((global as any).processTrendingShow).toHaveBeenCalledTimes(items.length);
  });

  it('aggregateResults collects totals and counters', () => {
    const stats = aggregateResults([
      {
        skipped: false,
        updated: 1,
        added: 2,
        ratingsUpdated: 1,
        bucketsUpserted: 3,
        snapshotsInserted: 1,
        snapshotsUnchanged: 0,
        snapshotsProcessed: 1,
      },
      {
        skipped: true,
        updated: 0,
        added: 0,
        ratingsUpdated: 0,
        bucketsUpserted: 0,
        snapshotsInserted: 0,
        snapshotsUnchanged: 1,
        snapshotsProcessed: 1,
        error: 'x',
      },
    ] as any);
    expect(stats.total).toBe(2);
    expect(stats.skipped).toBe(1);
    expect(stats.updated).toBe(1);
    expect(stats.added).toBe(2);
    expect(stats.ratingsUpdated).toBe(1);
    expect(stats.bucketsUpserted).toBe(3);
    expect(stats.snapshotsInserted).toBe(1);
    expect(stats.snapshotsUnchanged).toBe(1);
    expect(stats.snapshotsProcessed).toBe(2);
    expect(stats.errors).toBe(1);
  });
});
