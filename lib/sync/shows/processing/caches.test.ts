import { describe, it, expect } from 'vitest';
import {
  createProcessShowCaches,
  createDefaultProcessShowCaches,
  clearAllCaches,
  getCacheStats,
} from './caches';

describe('shows/processing/caches', () => {
  it('createProcessShowCaches створює кеші з заданими розмірами', () => {
    const caches = createProcessShowCaches({
      detailsCacheSize: 10,
      translationCacheSize: 11,
      providersCacheSize: 12,
      contentRatingCacheSize: 13,
      externalIdsCacheSize: 14,
    });
    caches.tmdbDetailsCache.set(1, { id: 1 } as any);
    caches.tmdbTranslationCache.set(1, { id: 1 } as any);
    caches.tmdbProvidersCache.set('1|UA', []);
    caches.tmdbContentRatingCache.set('1|UA', 'TV-14');
    caches.tmdbExternalIdsCache.set(1, { imdb_id: 'tt' } as any);
    expect(typeof caches.tmdbDetailsCache.get(1)).toBe('object');
    expect(typeof caches.tmdbTranslationCache.get(1)).toBe('object');
    expect(Array.isArray(caches.tmdbProvidersCache.get('1|UA'))).toBe(true);
    expect(caches.tmdbContentRatingCache.get('1|UA')).toBe('TV-14');
    expect(caches.tmdbExternalIdsCache.get(1)).toEqual({ imdb_id: 'tt' });
  });

  it('createDefaultProcessShowCaches повертає робочі кеші за замовчуванням', () => {
    const caches = createDefaultProcessShowCaches();
    caches.tmdbDetailsCache.set(2, { id: 2 } as any);
    expect(caches.tmdbDetailsCache.get(2)).toEqual({ id: 2 });
  });

  it('clearAllCaches замінює кеші на нові екземпляри', () => {
    const caches = createProcessShowCaches({ detailsCacheSize: 5 });
    const original = caches.tmdbDetailsCache;
    caches.tmdbDetailsCache.set(1, { id: 1 } as any);
    clearAllCaches(caches);
    expect(caches.tmdbDetailsCache).not.toBe(original);
    expect(caches.tmdbDetailsCache.get(1)).toBeUndefined();
  });

  it('getCacheStats повертає очікувані розміри', () => {
    const stats = getCacheStats(createDefaultProcessShowCaches());
    expect(stats.details.maxSize).toBe(300);
    expect(stats.translations.maxSize).toBe(300);
    expect(stats.providers.maxSize).toBe(400);
    expect(stats.contentRatings.maxSize).toBe(400);
    expect(stats.externalIds.maxSize).toBe(400);
  });
});
