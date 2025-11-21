/**
 * Управління кешами для обробки шоу: створення, конфігурація та допоміжні функції.
 *
 * @example
 * import { createProcessShowCaches } from '@/lib/sync/shows/processing/caches';
 * const caches = createProcessShowCaches();
 */

import { LRUCache } from '@/lib/sync/utils';
import type {
  TMDBShowDetails,
  TMDBShowTranslation,
  TMDBExternalIds,
  WatchProvider,
} from '@/lib/types';

/**
 * Конфігурація кешів для обробки шоу.
 */
export interface ProcessShowCacheConfig {
  /** Розмір кешу деталей шоу (за замовчуванням: 300) */
  detailsCacheSize?: number;
  /** Розмір кешу перекладів (за замовчуванням: 300) */
  translationCacheSize?: number;
  /** Розмір кешу провайдерів (за замовчуванням: 400) */
  providersCacheSize?: number;
  /** Розмір кешу рейтингів вмісту (за замовчуванням: 400) */
  contentRatingCacheSize?: number;
  /** Розмір кешу зовнішніх ID (за замовчуванням: 400) */
  externalIdsCacheSize?: number;
}

/**
 * Колекція кешів для обробки шоу.
 */
export interface ProcessShowCaches {
  /** Кеш деталей шоу з TMDB */
  tmdbDetailsCache: LRUCache<number, TMDBShowDetails>;
  /** Кеш перекладів шоу */
  tmdbTranslationCache: LRUCache<number, TMDBShowTranslation>;
  /** Кеш провайдерів перегляду */
  tmdbProvidersCache: LRUCache<string, WatchProvider[]>;
  /** Кеш рейтингів вмісту за регіонами */
  tmdbContentRatingCache: LRUCache<string, string | null>;
  /** Кеш зовнішніх ID (IMDB та ін.) */
  tmdbExternalIdsCache: LRUCache<number, TMDBExternalIds>;
}

/**
 * Створює колекцію кешів для обробки шоу з заданою конфігурацією.
 *
 * @param config Конфігурація кешів
 * @returns Колекція кешів
 *
 * @example
 * const caches = createProcessShowCaches({
 *   detailsCacheSize: 500,
 *   providersCacheSize: 600
 * });
 */
export function createProcessShowCaches(config: ProcessShowCacheConfig = {}): ProcessShowCaches {
  const {
    detailsCacheSize = 300,
    translationCacheSize = 300,
    providersCacheSize = 400,
    contentRatingCacheSize = 400,
    externalIdsCacheSize = 400,
  } = config;

  return {
    tmdbDetailsCache: new LRUCache<number, TMDBShowDetails>(detailsCacheSize),
    tmdbTranslationCache: new LRUCache<number, TMDBShowTranslation>(translationCacheSize),
    tmdbProvidersCache: new LRUCache<string, WatchProvider[]>(providersCacheSize),
    tmdbContentRatingCache: new LRUCache<string, string | null>(contentRatingCacheSize),
    tmdbExternalIdsCache: new LRUCache<number, TMDBExternalIds>(externalIdsCacheSize),
  };
}

/**
 * Створює стандартну колекцію кешів з типовими розмірами.
 *
 * @returns Колекція кешів з типовими налаштуваннями
 *
 * @example
 * const caches = createDefaultProcessShowCaches();
 */
export function createDefaultProcessShowCaches(): ProcessShowCaches {
  return createProcessShowCaches();
}

/**
 * Очищає всі кеші в колекції.
 *
 * @param caches Колекція кешів для очищення
 *
 * @example
 * const caches = createProcessShowCaches();
 * // ... використання кешів ...
 * clearAllCaches(caches);
 */
export function clearAllCaches(caches: ProcessShowCaches): void {
  // LRUCache не має методу clear(), тому створюємо нові екземпляри
  const config = {
    detailsCacheSize: 300,
    translationCacheSize: 300,
    providersCacheSize: 400,
    contentRatingCacheSize: 400,
    externalIdsCacheSize: 400,
  };

  const newCaches = createProcessShowCaches(config);
  Object.assign(caches, newCaches);
}

/**
 * Отримує статистику використання кешів.
 *
 * @param _caches Колекція кешів (не використовується, але залишено для сумісності)
 * @returns Статистика по кожному кешу
 *
 * @example
 * const caches = createProcessShowCaches();
 * const stats = getCacheStats(caches);
 * console.log(`Details cache configured size: ${stats.details.maxSize}`);
 */
export function getCacheStats(_caches: ProcessShowCaches): {
  details: { maxSize: number };
  translations: { maxSize: number };
  providers: { maxSize: number };
  contentRatings: { maxSize: number };
  externalIds: { maxSize: number };
} {
  return {
    details: {
      maxSize: 300,
    },
    translations: {
      maxSize: 300,
    },
    providers: {
      maxSize: 400,
    },
    contentRatings: {
      maxSize: 400,
    },
    externalIds: {
      maxSize: 400,
    },
  };
}
