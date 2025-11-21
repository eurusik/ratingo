import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMovie } from './main';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    transaction: vi.fn(async (cb) => {
      const tx = {};
      await cb(tx);
    }),
  },
}));
vi.mock('@/db/schema', () => ({
  movies: { ratingTrakt: { name: 'rating_trakt' }, tmdbId: { name: 'tmdb_id' } },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, eq: vi.fn((f, v) => `eq(${f.name}, ${v})`) };
});

vi.mock('@/lib/sync/utils', () => ({
  cachedWithRetry: vi.fn((cache, key, tag, fn) => ({ tag })),
}));
vi.mock('@/lib/api/tmdb', () => ({
  tmdbClient: {
    getMovieDetails: vi.fn(),
    getMovieTranslation: vi.fn(),
  },
}));
vi.mock('@/lib/sync/movies/upserts', () => ({
  upsertMovie: vi.fn(),
  upsertMovieRatings: vi.fn(),
  upsertRatingBuckets: vi.fn(),
  upsertMovieVideos: vi.fn(),
  upsertProvidersRegistry: vi.fn(),
  upsertMovieWatchProviders: vi.fn(),
  upsertContentRatings: vi.fn(),
  upsertMovieCast: vi.fn(),
  upsertWatchersSnapshot: vi.fn(),
}));
vi.mock('./utils', () => ({
  fetchVideosAndCast: vi.fn(async () => ({ preferredVideos: [], cast: [] })),
  resolveImdbId: vi.fn(async () => 'tt001'),
  fetchOmdbAggregatedRatings: vi.fn(async () => ({
    imdbRating: 7,
    imdbVotes: 1000,
    ratingMetacritic: 80,
  })),
  fetchTraktRatingsForMovie: vi.fn(async () => ({
    ratingTraktAvg: 8,
    ratingTraktVotes: 500,
    ratingDistribution: { 10: 5 },
  })),
  computePrimaryRating: vi.fn(() => 7.5),
  combineWatchProvidersWithFallback: vi.fn(async () => [{ region: 'UA', id: 1 }]),
  fetchContentRatingsByRegion: vi.fn(async () => ({ UA: '12+', US: 'PG-13' })),
  buildMovieRecord: vi.fn(() => ({ any: 'record' })),
}));

import { db } from '@/db';
import {
  upsertMovie,
  upsertMovieRatings,
  upsertRatingBuckets,
  upsertMovieVideos,
  upsertProvidersRegistry,
  upsertMovieWatchProviders,
  upsertContentRatings,
  upsertMovieCast,
  upsertWatchersSnapshot,
} from '@/lib/sync/movies/upserts';

describe('movies/processing/main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.limit).mockResolvedValue([{ ratingTraktPrev: 40 }]);
    vi.mocked(upsertMovie).mockResolvedValue({ movieId: 101, isUpdate: true } as any);
    vi.mocked(upsertMovieRatings).mockResolvedValue(undefined as any);
    vi.mocked(upsertRatingBuckets).mockResolvedValue(2 as any);
    vi.mocked(upsertMovieVideos).mockResolvedValue(undefined as any);
    vi.mocked(upsertProvidersRegistry).mockResolvedValue(undefined as any);
    vi.mocked(upsertMovieWatchProviders).mockResolvedValue(undefined as any);
    vi.mocked(upsertContentRatings).mockResolvedValue(undefined as any);
    vi.mocked(upsertMovieCast).mockResolvedValue(undefined as any);
    vi.mocked(upsertWatchersSnapshot).mockResolvedValue('inserted' as any);
  });

  it('processes movie end-to-end and updates metrics', async () => {
    const traktItem = {
      movie: { title: 'M', ids: { tmdb: 123, slug: 'm', trakt: 99 } },
      watchers: 50,
    } as any;
    const ctx = {
      monthly: { m0: { 123: 5 }, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      maxWatchers: 10000,
      tmdbDetailsCache: {},
      tmdbTranslationCache: {},
      tmdbProvidersCache: {},
      tmdbExternalIdsCache: {},
    } as any;
    const res = await processMovie(traktItem, ctx);
    expect(upsertMovie).toHaveBeenCalledWith(expect.any(Object), 123, expect.any(Object));
    expect(upsertMovieRatings).toHaveBeenCalledTimes(1);
    expect(upsertRatingBuckets).toHaveBeenCalledTimes(1);
    expect(upsertMovieVideos).toHaveBeenCalledTimes(1);
    expect(upsertProvidersRegistry).toHaveBeenCalledTimes(1);
    expect(upsertMovieWatchProviders).toHaveBeenCalledTimes(1);
    expect(upsertContentRatings).toHaveBeenCalledTimes(1);
    expect(upsertMovieCast).toHaveBeenCalledTimes(1);
    expect(upsertWatchersSnapshot).toHaveBeenCalledTimes(1);
    expect(res.updated).toBe(1);
    expect(res.added).toBe(0);
    expect(res.ratingsUpdated).toBe(1);
    expect(res.bucketsUpserted).toBe(2);
    expect(res.snapshotsProcessed).toBe(1);
    expect(res.snapshotsInserted).toBe(1);
    expect(res.snapshotsUnchanged).toBe(0);
    expect(res.skipped).toBe(false);
    expect(res.error).toBeUndefined();
  });

  it('skips when tmdbId is missing', async () => {
    const res = await processMovie(
      { movie: { ids: {} }, watchers: 0 } as any,
      { monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} }, maxWatchers: 10000 } as any
    );
    expect(res.skipped).toBe(true);
    expect(res.updated).toBe(0);
    expect(res.added).toBe(0);
  });

  it('handles errors and sets error message', async () => {
    vi.mocked(upsertMovie).mockRejectedValueOnce(new Error('fail'));
    const traktItem = { movie: { title: 'M', ids: { tmdb: 123 } }, watchers: 50 } as any;
    const ctx = {
      monthly: { m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} },
      maxWatchers: 10000,
      tmdbDetailsCache: {},
      tmdbTranslationCache: {},
      tmdbProvidersCache: {},
      tmdbExternalIdsCache: {},
    } as any;
    const res = await processMovie(traktItem, ctx);
    expect(res.error).toMatch(/Movie sync error/);
  });
});
