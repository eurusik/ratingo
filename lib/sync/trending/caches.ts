/**
 * Модуль для управління кешами TMDB даних під час trending синхронізації
 */

import { LRUCache } from '@/lib/sync/utils';

/**
 * Створює та конфігурує всі необхідні кеші для trending синхронізації
 */
export function createTrendingCaches() {
  return {
    tmdbDetailsCache: new LRUCache<number, any>(600),
    tmdbTranslationCache: new LRUCache<number, any>(600),
    tmdbProvidersCache: new LRUCache<string, any[]>(800),
    tmdbContentRatingCache: new LRUCache<string, any>(800),
    tmdbExternalIdsCache: new LRUCache<number, any>(800),
  };
}
