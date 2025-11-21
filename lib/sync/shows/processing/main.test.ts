import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processShow } from './main';

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (cb: any) => {
      const tx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
      };
      await cb(tx);
    }),
  },
}));
vi.mock('@/db/schema', () => ({
  shows: { id: { name: 'id' }, tmdbId: { name: 'tmdb_id' }, ratingTrakt: { name: 'rating_trakt' } },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((f: any, v: any) => `eq(${f.name}, ${v})`),
  inArray: vi.fn((f: any, arr: any[]) => `inArray(${f.name}, ${arr.join(',')})`),
  and: vi.fn(() => 'and'),
}));

vi.mock('./api', () => ({
  createShowApiClients: vi.fn(() => ({
    getShowDetails: vi.fn(async () => ({ id: 123, name: 'Show', vote_average: 7.5 }) as any),
    getShowTranslation: vi.fn(
      async () => ({ titleUk: 'Назва', overviewUk: 'Опис', posterUk: '/p-uk.jpg' }) as any
    ),
    getShowVideos: vi.fn(async () => [{ site: 'YouTube', type: 'Trailer', key: 'x' }] as any),
    getShowCredits: vi.fn(async () => ({ cast: [{ id: 1 }, { id: 2 }] }) as any),
    getWatchProviders: vi.fn(
      async (_id: number, region: string) => [{ id: 1, region, name: 'P' }] as any
    ),
    getContentRating: vi.fn(async (_id: number, region: string) =>
      region === 'UA' ? '16+' : 'TV-14'
    ),
    getExternalIds: vi.fn(async () => ({ imdb_id: 'tt001' }) as any),
    getTraktRatings: vi.fn(
      async () => ({ rating: 7.0, votes: 100, distribution: { 10: 5 } }) as any
    ),
  })),
}));

vi.mock('./metrics', () => ({
  computeDeltas: vi.fn(async () => ({ trendingScore: 70, delta3mVal: 12, watchersDelta: 3 })),
}));

vi.mock('./database', () => ({
  upsertShow: vi.fn(async () => ({ showId: 10, isUpdate: true })),
  upsertShowRatings: vi.fn(async () => {}),
  upsertShowRatingBuckets: vi.fn(async () => 2),
  upsertShowWatchProviders: vi.fn(async () => {}),
  upsertShowWatchersSnapshot: vi.fn(async () => 'inserted'),
}));

vi.mock('@/lib/sync/related', () => ({
  getRelatedTmdbIds: vi.fn(async () => ({ ids: [101, 102], source: 'tmdb' })),
}));
vi.mock('./related', () => ({
  ensureRelatedShows: vi.fn(async () => 1),
  linkRelated: vi.fn(async () => 2),
}));

import { db } from '@/db';
import {
  upsertShow,
  upsertShowRatings,
  upsertShowRatingBuckets,
  upsertShowWatchProviders,
  upsertShowWatchersSnapshot,
} from './database';

describe('shows/processing/main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('обробляє шоу end-to-end та оновлює лічильники', async () => {
    const traktItem: any = {
      show: { title: 'S', ids: { tmdb: 123, slug: 'slug', trakt: 42 } },
      watchers: 50,
    };
    const ctx: any = {
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      maxWatchers: 10000,
      animeKeywords: ['аніме', 'anime'],
      tmdbDetailsCache: {},
      tmdbTranslationCache: {},
      tmdbProvidersCache: {},
      tmdbContentRatingCache: {},
      tmdbExternalIdsCache: {},
      currentTrendingTmdbIds: new Set<number>(),
      onRetryLabel: () => vi.fn(),
    };
    const res = await processShow(traktItem, ctx);
    expect(upsertShow).toHaveBeenCalledWith(expect.any(Object), 123, expect.any(Object));
    expect(upsertShowRatings).toHaveBeenCalledTimes(1);
    expect(upsertShowRatingBuckets).toHaveBeenCalledTimes(1);
    expect(upsertShowWatchProviders).toHaveBeenCalledTimes(1);
    expect(upsertShowWatchersSnapshot).toHaveBeenCalledTimes(1);
    expect(res.updated).toBe(1);
    expect(res.added).toBe(0);
    expect(res.ratingsUpdated).toBe(1);
    expect(res.bucketsUpserted).toBe(2);
    expect(res.snapshotsProcessed).toBe(1);
    expect(res.snapshotsInserted).toBe(1);
    expect(res.snapshotsUnchanged).toBe(0);
    expect(res.relatedShowsInserted).toBe(1);
    expect(res.relatedLinksAdded).toBe(2);
    expect(res.relatedSourceCounts.tmdb).toBe(2);
    expect(res.relatedCandidatesTotal).toBe(2);
    expect(res.relatedShowsWithCandidates).toBe(1);
    expect(res.skipped).toBe(false);
    expect(res.error).toBeUndefined();
  });

  it('пропускає коли відсутній tmdbId', async () => {
    const res = await processShow(
      { show: { ids: {} }, watchers: 0 } as any,
      { animeKeywords: [], monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} } } as any
    );
    expect(res.skipped).toBe(true);
    expect(res.updated).toBe(0);
    expect(res.added).toBe(0);
  });

  it('пропускає аніме за TMDB жанром/перекладом', async () => {
    // Підміняємо createShowApiClients щоб повернути жанр 16
    const clients = (await import('./api')).createShowApiClients as any;
    vi.mocked(clients).mockReturnValueOnce({
      getShowDetails: vi.fn(async () => ({ id: 321, genres: [{ id: 16 }], name: 'Anime' })),
      getShowTranslation: vi.fn(async () => ({ titleUk: 'Аніме' })),
    });
    const res = await processShow(
      { show: { ids: { tmdb: 321 }, title: 'Anime' } } as any,
      {
        animeKeywords: ['аніме'],
        monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      } as any
    );
    expect(res.skipped).toBe(true);
  });

  it('обробляє помилку і виставляє повідомлення', async () => {
    vi.mocked(upsertShow).mockRejectedValueOnce(new Error('fail'));
    const traktItem: any = { show: { title: 'S', ids: { tmdb: 123 } }, watchers: 50 };
    const ctx: any = {
      animeKeywords: [],
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      tmdbDetailsCache: {},
      tmdbTranslationCache: {},
      tmdbProvidersCache: {},
      tmdbContentRatingCache: {},
      tmdbExternalIdsCache: {},
      currentTrendingTmdbIds: new Set(),
      onRetryLabel: () => vi.fn(),
      maxWatchers: 10000,
    };
    const res = await processShow(traktItem, ctx);
    expect(res.error).toMatch(/Show sync error/);
  });
});
