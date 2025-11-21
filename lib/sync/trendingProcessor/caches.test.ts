import { describe, it, expect } from 'vitest';
import {
  createTrendingCache,
  clearTrendingCache,
  getCacheStats,
  DEFAULT_CACHE_CONFIG,
} from './caches';

describe('trendingProcessor/caches', () => {
  it('createTrendingCache returns configured caches', () => {
    const cache = createTrendingCache();
    expect(cache.currentTrending.size).toBe(0);
    cache.details.set(1, { id: 1 } as any);
    expect(cache.details.get(1)).toEqual({ id: 1 });
    cache.translations.set(2, { titleUk: 'x' } as any);
    expect(cache.translations.get(2)).toEqual({ titleUk: 'x' });
    cache.providers.set('1|UA', [{ id: 8 }] as any);
    expect(cache.providers.get('1|UA')).toEqual([{ id: 8 }]);
    cache.contentRatings.set('1|UA', '16+');
    expect(cache.contentRatings.get('1|UA')).toBe('16+');
    cache.externalIds.set(3, { imdb_id: 'tt3' } as any);
    expect(cache.externalIds.get(3)).toEqual({ imdb_id: 'tt3' });
  });

  it('clearTrendingCache resets caches and trending set', () => {
    const cache = createTrendingCache();
    cache.currentTrending.add(1);
    expect(getCacheStats(cache).trending).toBe(1);
    clearTrendingCache(cache);
    expect(getCacheStats(cache).trending).toBe(0);
    expect(cache.details.get(1)).toBeUndefined();
  });

  it('supports custom sizes via config override', () => {
    const cache = createTrendingCache({ detailsSize: DEFAULT_CACHE_CONFIG.detailsSize + 1 });
    cache.details.set(1, { id: 1 } as any);
    expect(cache.details.get(1)).toEqual({ id: 1 });
  });
});
