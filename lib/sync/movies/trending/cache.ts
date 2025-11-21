/**
 * @fileoverview Управління кешами для trending movies processor
 */

import { LRUCache } from '@/lib/sync/utils';

/**
 * Ініціалізувати всі кеші для обробки фільмів
 *
 * @returns Об'єкт з усіма кешами
 *
 * @example
 * ```typescript
 * const caches = initializeCaches();
 * const { tmdbDetailsCache, tmdbTranslationCache } = caches;
 * ```
 */
export function initializeCaches() {
  return {
    tmdbDetailsCache: new LRUCache<number, any>(300),
    tmdbTranslationCache: new LRUCache<number, any>(300),
    tmdbProvidersCache: new LRUCache<string, any[]>(400),
    tmdbExternalIdsCache: new LRUCache<number, any>(400),
  };
}

/**
 * Отримати щомісячні мапи для фільмів
 *
 * @returns Проміс з щомісячними мапами
 *
 * @example
 * ```typescript
 * const monthlyMaps = await getMonthlyMaps();
 * console.log('Monthly maps loaded');
 * ```
 */
export async function getMonthlyMaps() {
  const { buildMonthlyMapsMovies } = await import('@/lib/sync/monthly');
  return await buildMonthlyMapsMovies();
}
