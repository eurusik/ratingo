import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LRUCache } from '@/lib/sync/utils';
import { createShowApiClients } from './api';

vi.mock('@/lib/api/tmdb', () => ({
  tmdbClient: {
    getShowDetails: vi.fn(),
    getShowTranslation: vi.fn(),
    getWatchProvidersByRegion: vi.fn(),
    getContentRatingByRegion: vi.fn(),
    getShowExternalIds: vi.fn(),
    getShowVideos: vi.fn(),
    getAggregateCredits: vi.fn(),
  },
}));

vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    getShowRatings: vi.fn(),
  },
}));

vi.mock('@/lib/api/omdb', () => ({
  omdbClient: {
    getAggregatedRatings: vi.fn(),
  },
}));

vi.mock('@/lib/sync/utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/sync/utils')>();
  return {
    ...original,
    withRetry: vi.fn(async (fn: any) => await fn()),
  };
});

import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { omdbClient } from '@/lib/api/omdb';

describe('shows/processing/api', () => {
  const caches = {
    tmdbDetailsCache: new LRUCache<number, any>(300),
    tmdbTranslationCache: new LRUCache<number, any>(300),
    tmdbProvidersCache: new LRUCache<string, any[]>(400),
    tmdbContentRatingCache: new LRUCache<string, any>(400),
    tmdbExternalIdsCache: new LRUCache<number, any>(400),
  } as any;
  const onRetryLabel = (_label: string) => vi.fn();
  const api = createShowApiClients({ caches, onRetryLabel });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getShowDetails кешує результат', async () => {
    vi.mocked(tmdbClient.getShowDetails).mockResolvedValue({ id: 1 } as any);
    const a = await api.getShowDetails(100);
    const b = await api.getShowDetails(100);
    expect(a).toEqual({ id: 1 });
    expect(b).toEqual({ id: 1 });
    expect(tmdbClient.getShowDetails).toHaveBeenCalledTimes(1);
  });

  it('getShowTranslation кешує результат', async () => {
    vi.mocked(tmdbClient.getShowTranslation).mockResolvedValue({ titleUk: 'T' } as any);
    await api.getShowTranslation(101);
    await api.getShowTranslation(101);
    expect(tmdbClient.getShowTranslation).toHaveBeenCalledTimes(1);
  });

  it('getWatchProviders кешує окремо по регіонах', async () => {
    vi.mocked(tmdbClient.getWatchProvidersByRegion).mockImplementation(
      async (_id: number, region: string) =>
        (region === 'UA' ? [{ region: 'UA', id: 1 }] : [{ region: 'US', id: 2 }]) as any
    );
    await api.getWatchProviders(200, 'UA');
    await api.getWatchProviders(200, 'UA');
    await api.getWatchProviders(200, 'US');
    expect(tmdbClient.getWatchProvidersByRegion).toHaveBeenCalledTimes(2);
  });

  it('getContentRating кешує по регіону', async () => {
    vi.mocked(tmdbClient.getContentRatingByRegion).mockResolvedValue('16+' as any);
    const a = await api.getContentRating(300, 'UA');
    const b = await api.getContentRating(300, 'UA');
    expect(a).toBe('16+');
    expect(b).toBe('16+');
    expect(tmdbClient.getContentRatingByRegion).toHaveBeenCalledTimes(1);
  });

  it('getExternalIds кешує результат', async () => {
    vi.mocked(tmdbClient.getShowExternalIds).mockResolvedValue({ imdb_id: 'tt1' } as any);
    await api.getExternalIds(400);
    await api.getExternalIds(400);
    expect(tmdbClient.getShowExternalIds).toHaveBeenCalledTimes(1);
  });

  it('getShowVideos повертає масив results', async () => {
    vi.mocked(tmdbClient.getShowVideos).mockResolvedValue({ results: [{ a: 1 }] } as any);
    const res = await api.getShowVideos(500);
    expect(res).toEqual([{ a: 1 }]);
  });

  it('getShowCredits повертає кредити', async () => {
    vi.mocked(tmdbClient.getAggregateCredits).mockResolvedValue([{ id: 1 }] as any);
    const res = await api.getShowCredits(600);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('getTraktRatings повертає обʼєкт рейтингів', async () => {
    vi.mocked(traktClient.getShowRatings).mockResolvedValue({
      rating: 8,
      votes: 100,
      distribution: { 10: 5 },
    } as any);
    const res = await api.getTraktRatings('slug');
    expect(res.rating).toBe(8);
    expect(res.votes).toBe(100);
  });

  it('getOmdbRatings повертає агреговані рейтинги', async () => {
    vi.mocked(omdbClient.getAggregatedRatings).mockResolvedValue({
      imdbRating: 7.5,
      imdbVotes: 20000,
      rottenTomatoes: 85,
      metacritic: 70,
      metascore: 70,
    } as any);
    const res = await api.getOmdbRatings('tt123');
    expect(res.imdbRating).toBe(7.5);
    expect(res.rottenTomatoes).toBe(85);
  });
});
