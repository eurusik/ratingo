import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectPreferredVideos,
  fetchVideosAndCast,
  resolveImdbId,
  fetchOmdbAggregatedRatings,
  fetchTraktRatingsForMovie,
  computePrimaryRating,
  combineWatchProvidersWithFallback,
  fetchContentRatingsByRegion,
  buildMovieRecord,
} from './utils';

vi.mock('@/lib/api/tmdb', () => ({
  tmdbClient: {
    getMovieVideos: vi.fn(),
    getMovieCredits: vi.fn(),
    getMovieExternalIds: vi.fn(),
    getMovieWatchProvidersByRegion: vi.fn(),
    getMovieWatchProvidersAny: vi.fn(),
    getMovieContentRatingByRegion: vi.fn(),
  },
}));
vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    getMovieRatings: vi.fn(),
  },
}));
vi.mock('@/lib/api/omdb', () => ({
  omdbClient: {
    getAggregatedRatingsMovie: vi.fn(),
  },
}));
vi.mock('@/lib/sync/utils', () => ({
  withRetry: vi.fn((fn) => fn()),
  cachedWithRetry: vi.fn((cache, key, tag, fn) => fn()),
}));

import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { omdbClient } from '@/lib/api/omdb';
import { withRetry, cachedWithRetry } from '@/lib/sync/utils';

describe('movies/processing/utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selectPreferredVideos returns preferred YouTube types or falls back to all YouTube', () => {
    const all = [
      { site: 'YouTube', type: 'Clip' },
      { site: 'YouTube', type: 'Featurette' },
      { site: 'Vimeo', type: 'Trailer' },
    ];
    const res = selectPreferredVideos(all as any);
    expect(res.map((v) => v.type)).toEqual(['Clip', 'Featurette']);
    const res2 = selectPreferredVideos([{ site: 'YouTube', type: 'Other' }] as any);
    expect(res2.map((v) => v.type)).toEqual(['Other']);
  });

  it('fetchVideosAndCast aggregates videos and maps cast', async () => {
    vi.mocked(tmdbClient.getMovieVideos).mockResolvedValue({
      results: [
        { site: 'YouTube', type: 'Teaser' },
        { site: 'YouTube', type: 'Trailer' },
      ],
    });
    vi.mocked(tmdbClient.getMovieCredits).mockResolvedValue({
      cast: [
        { id: 1, name: 'A', character: 'X', profile_path: '/p', order: 0 },
        { id: 2, name: 'B' },
      ],
    });
    const { preferredVideos, cast } = await fetchVideosAndCast(10);
    expect(preferredVideos.length).toBe(2);
    expect(cast[0]).toEqual({ id: 1, name: 'A', character: 'X', profile_path: '/p', order: 0 });
    expect(cast[1]).toEqual({ id: 2, name: 'B', character: null, profile_path: null, order: null });
    expect(withRetry).toHaveBeenCalled();
  });

  it('resolveImdbId returns direct id or fetches external ids', async () => {
    const ctx = { tmdbExternalIdsCache: {} } as any;
    const direct = await resolveImdbId({ imdb: 'tt123' }, 10, ctx);
    expect(direct).toBe('tt123');
    vi.mocked(tmdbClient.getMovieExternalIds).mockResolvedValue({ imdb_id: 'tt999' });
    const viaExt = await resolveImdbId({}, 11, ctx);
    expect(cachedWithRetry).toHaveBeenCalled();
    expect(viaExt).toBe('tt999');
  });

  it('fetchOmdbAggregatedRatings returns nulls without api key and values with key', async () => {
    const backup = process.env.OMDB_API_KEY;
    delete process.env.OMDB_API_KEY;
    const none = await fetchOmdbAggregatedRatings('tt1');
    expect(none).toEqual({ imdbRating: null, imdbVotes: null, ratingMetacritic: null });
    process.env.OMDB_API_KEY = 'key';
    vi.mocked(omdbClient.getAggregatedRatingsMovie).mockResolvedValue({
      imdbRating: 7.5,
      imdbVotes: 1234,
      metascore: 80,
    });
    const vals = await fetchOmdbAggregatedRatings('tt2');
    expect(vals).toEqual({ imdbRating: 7.5, imdbVotes: 1234, ratingMetacritic: 80 });
    process.env.OMDB_API_KEY = backup;
  });

  it('fetchTraktRatingsForMovie returns ratings or nulls on error', async () => {
    vi.mocked(traktClient.getMovieRatings).mockResolvedValue({
      rating: 8.1,
      votes: 100,
      distribution: { 10: 5 },
    });
    const ok = await fetchTraktRatingsForMovie('slug');
    expect(ok).toEqual({
      ratingTraktAvg: 8.1,
      ratingTraktVotes: 100,
      ratingDistribution: { 10: 5 },
    });
    vi.mocked(traktClient.getMovieRatings).mockRejectedValue(new Error('x'));
    const err = await fetchTraktRatingsForMovie('slug');
    expect(err).toEqual({ ratingTraktAvg: null, ratingTraktVotes: null });
  });

  it('computePrimaryRating prioritizes tmdb then trakt then imdb', () => {
    expect(computePrimaryRating(8.9, 8.1, 7.7)).toBe(8.9);
    expect(computePrimaryRating(null, 8.1, 7.7)).toBe(8.1);
    expect(computePrimaryRating(null, null, 7.7)).toBe(7.7);
    expect(computePrimaryRating(null, null, null)).toBeNull();
  });

  it('combineWatchProvidersWithFallback merges UA+US and falls back to any', async () => {
    const ctx = { tmdbProvidersCache: {} } as any;
    vi.mocked(tmdbClient.getMovieWatchProvidersByRegion).mockImplementation(async (id, region) => {
      if (region === 'UA')
        return [
          { region: 'UA', id: 1 },
          { region: 'UA', id: 2 },
        ];
      if (region === 'US')
        return [
          { region: 'US', id: 2 },
          { region: 'US', id: 3 },
        ];
      return [];
    });
    const merged = await combineWatchProvidersWithFallback(10, ctx);
    expect(merged).toEqual([
      { region: 'UA', id: 1 },
      { region: 'UA', id: 2 },
      { region: 'US', id: 2 },
      { region: 'US', id: 3 },
    ]);
    vi.mocked(tmdbClient.getMovieWatchProvidersByRegion)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(tmdbClient.getMovieWatchProvidersAny).mockResolvedValue([{ region: 'CA', id: 9 }]);
    const fallback = await combineWatchProvidersWithFallback(11, ctx);
    expect(fallback).toEqual([{ region: 'CA', id: 9 }]);
  });

  it('fetchContentRatingsByRegion returns UA and US values, handles failures', async () => {
    vi.mocked(tmdbClient.getMovieContentRatingByRegion).mockImplementation(async (id, region) => {
      if (region === 'UA') return '12+';
      throw new Error('fail');
    });
    const res = await fetchContentRatingsByRegion(10);
    expect(res).toEqual({ UA: '12+', US: null });
  });

  it('buildMovieRecord maps fields correctly', () => {
    const record = buildMovieRecord({
      tmdbId: 5,
      traktMovie: { title: 'T', ids: { imdb: 'tt5' } },
      details: {
        title: 'DT',
        overview: 'O',
        poster_path: '/p',
        backdrop_path: '/b',
        vote_average: 7.2,
        vote_count: 200,
        popularity: 99,
        release_date: '2020-01-01',
        runtime: 120,
        genres: [{ id: 1, name: 'Action' }],
        status: 'Released',
        tagline: 'Tag',
      } as any,
      translation: { titleUk: 'TU', overviewUk: 'OU', posterUk: '/pu' } as any,
      ratings: {
        imdbRating: 7,
        imdbVotes: 1000,
        ratingMetacritic: 80,
        traktAvg: 8,
        traktVotes: 500,
      },
      watchers: 10,
      watchersDelta: 2,
      delta3m: 3,
      primaryRating: 7.5,
      trendingScore: 50,
      preferredVideos: [{ site: 'YouTube', type: 'Trailer' }] as any,
      watchProviders: [{ region: 'UA', id: 1 }] as any,
      cast: [{ id: 1, name: 'A', character: null, profile_path: null, order: null }] as any,
    });
    expect(record.tmdbId).toBe(5);
    expect(record.imdbId).toBe('tt5');
    expect(record.title).toBe('T');
    expect(record.titleUk).toBe('TU');
    expect(record.poster).toBe('/p');
    expect(record.posterUk).toBe('/pu');
    expect(record.ratingTmdb).toBe(7.2);
    expect(record.ratingTrakt).toBe(10);
    expect(record.trendingScore).toBe(50);
    expect(Array.isArray(record.videos)).toBe(true);
    expect(record.trendingUpdatedAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
  });
});
