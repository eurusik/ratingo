import { describe, it, expect } from 'vitest';
import { createTrendingMoviesCache, clearTrendingMoviesCache, getCacheStats } from './caches';

describe('movies/trending/caches', () => {
  it('createTrendingMoviesCache returns caches that store values', () => {
    const caches = createTrendingMoviesCache();
    caches.details.set(1, { id: 1 } as any);
    expect(caches.details.get(1)).toEqual({ id: 1 });
    caches.translations.set(2, { titleUk: 't' } as any);
    expect(caches.translations.get(2)).toEqual({ titleUk: 't' });
    caches.providers.set('1|UA', [{ id: 8 }] as any);
    expect(caches.providers.get('1|UA')).toEqual([{ id: 8 }]);
    caches.externalIds.set(3, { imdb_id: 'tt3' } as any);
    expect(caches.externalIds.get(3)).toEqual({ imdb_id: 'tt3' });
  });

  it('clearTrendingMoviesCache resets caches', () => {
    const caches = createTrendingMoviesCache();
    caches.details.set(1, { id: 1 } as any);
    clearTrendingMoviesCache(caches);
    expect(caches.details.get(1)).toBeUndefined();
  });

  it('getCacheStats returns zeros (LRU size not exposed)', () => {
    const stats = getCacheStats(createTrendingMoviesCache());
    expect(stats.detailsSize).toBe(0);
    expect(stats.translationsSize).toBe(0);
    expect(stats.providersSize).toBe(0);
    expect(stats.externalIdsSize).toBe(0);
  });
});
