import { describe, it, expect } from 'vitest';
import { createTrendingCaches } from './caches';

describe('trending/caches', () => {
  it('createTrendingCaches returns working LRU caches', () => {
    const caches = createTrendingCaches();
    caches.tmdbDetailsCache.set(1, { id: 1 });
    expect(caches.tmdbDetailsCache.get(1)).toEqual({ id: 1 });
    caches.tmdbTranslationCache.set(2, { titleUk: 't' });
    expect(caches.tmdbTranslationCache.get(2)).toEqual({ titleUk: 't' });
    caches.tmdbProvidersCache.set('1|UA', [{ id: 8 }]);
    expect(caches.tmdbProvidersCache.get('1|UA')).toEqual([{ id: 8 }]);
    caches.tmdbContentRatingCache.set('1|UA', '16+');
    expect(caches.tmdbContentRatingCache.get('1|UA')).toBe('16+');
    caches.tmdbExternalIdsCache.set(3, { imdb_id: 'tt3' });
    expect(caches.tmdbExternalIdsCache.get(3)).toEqual({ imdb_id: 'tt3' });
  });
});
