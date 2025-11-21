/**
 * Cache management for trending processor operations
 * Provides centralized cache initialization and management for TMDB data
 *
 * @module trendingCaches
 * @example
 * import { createTrendingCache, DEFAULT_CACHE_CONFIG } from '@/lib/sync/trendingProcessor/caches';
 * const cache = createTrendingCache();
 */

import { LRUCache } from '@/lib/sync/utils';
import type {
  TMDBShowDetails,
  TMDBShowTranslation,
  WatchProvider,
  TMDBExternalIds,
} from '@/lib/types';
import type { TrendingCache, CacheConfig } from './types';

/**
 * Default cache configuration with optimized sizes for trending operations
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  detailsSize: 300,
  translationSize: 300,
  providersSize: 400,
  contentRatingSize: 400,
  externalIdsSize: 400,
};

/**
 * Creates a new trending cache instance with all required caches
 *
 * @param config - Optional cache configuration
 * @returns Complete cache container
 * @example
 * const cache = createTrendingCache();
 * const cacheWithCustomSizes = createTrendingCache({
 *   detailsSize: 500,
 *   translationSize: 200,
 * });
 */
export function createTrendingCache(config: Partial<CacheConfig> = {}): TrendingCache {
  const finalConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

  return {
    details: new LRUCache<number, TMDBShowDetails>(finalConfig.detailsSize),
    translations: new LRUCache<number, TMDBShowTranslation>(finalConfig.translationSize),
    providers: new LRUCache<string, WatchProvider[]>(finalConfig.providersSize),
    contentRatings: new LRUCache<string, string | null>(finalConfig.contentRatingSize),
    externalIds: new LRUCache<number, TMDBExternalIds>(finalConfig.externalIdsSize),
    currentTrending: new Set<number>(),
  };
}

/**
 * Clears all caches in the trending cache container
 *
 * @param cache - The cache container to clear
 * @example
 * const cache = createTrendingCache();
 * // ... use cache ...
 * clearTrendingCache(cache);
 */
export function clearTrendingCache(cache: TrendingCache): void {
  // Clear Map-based caches by recreating them with same config
  cache.details = new LRUCache<number, TMDBShowDetails>(DEFAULT_CACHE_CONFIG.detailsSize);
  cache.translations = new LRUCache<number, TMDBShowTranslation>(
    DEFAULT_CACHE_CONFIG.translationSize
  );
  cache.providers = new LRUCache<string, WatchProvider[]>(DEFAULT_CACHE_CONFIG.providersSize);
  cache.contentRatings = new LRUCache<string, string | null>(
    DEFAULT_CACHE_CONFIG.contentRatingSize
  );
  cache.externalIds = new LRUCache<number, TMDBExternalIds>(DEFAULT_CACHE_CONFIG.externalIdsSize);
  cache.currentTrending.clear();
}

/**
 * Gets cache statistics for monitoring and debugging
 *
 * @param cache - The cache container
 * @returns Cache usage statistics
 * @example
 * const cache = createTrendingCache();
 * const stats = getCacheStats(cache);
 * console.log(`Trending items: ${stats.trending}`);
 */
export function getCacheStats(cache: TrendingCache) {
  // Since LRUCache doesn't expose size, we can only track trending set size
  // In a real implementation, you might want to extend LRUCache to expose size
  return {
    trending: cache.currentTrending.size,
    note: 'LRUCache size tracking not available in current implementation',
  };
}
