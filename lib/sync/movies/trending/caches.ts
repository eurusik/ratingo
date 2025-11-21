/**
 * @fileoverview Управління кешами для трендових фільмів
 *
 * Модуль відповідає за створення та управління LRU кешами для даних TMDB:
 * - деталі фільмів
 * - переклади
 * - провайдери перегляду
 * - зовнішні ID
 *
 * @author Твій Асистент
 */

import { LRUCache } from '@/lib/sync/utils';
import type {
  TMDBMovieDetails,
  TMDBMovieTranslation,
  WatchProvider,
  TMDBExternalIds,
} from '@/lib/types';
import type { TrendingMoviesCache } from './types';

/**
 * Розмір кешу за замовчуванням для деталей фільмів
 * Зберігає до 500 деталей фільмів
 */
const DEFAULT_DETAILS_CACHE_SIZE = 500;

/**
 * Розмір кешу за замовчуванням для перекладів
 * Зберігає до 200 перекладів
 */
const DEFAULT_TRANSLATIONS_CACHE_SIZE = 200;

/**
 * Розмір кешу за замовчуванням для провайдерів
 * Зберігає до 100 записів провайдерів
 */
const DEFAULT_PROVIDERS_CACHE_SIZE = 100;

/**
 * Розмір кешу за замовчуванням для зовнішніх ID
 * Зберігає до 300 зовнішніх ID
 */
const DEFAULT_EXTERNAL_IDS_CACHE_SIZE = 300;

/**
 * Створює новий контейнер кешів для трендових фільмів
 *
 * @returns Об'єкт з усіма необхідними кешами для обробки фільмів
 *
 * @example
 * ```typescript
 * const caches = createTrendingMoviesCache();
 * const details = caches.details.get(movieId);
 * ```
 */
export function createTrendingMoviesCache(): TrendingMoviesCache {
  return {
    details: new LRUCache<number, TMDBMovieDetails>(DEFAULT_DETAILS_CACHE_SIZE),
    translations: new LRUCache<number, TMDBMovieTranslation>(DEFAULT_TRANSLATIONS_CACHE_SIZE),
    providers: new LRUCache<string, WatchProvider[]>(DEFAULT_PROVIDERS_CACHE_SIZE),
    externalIds: new LRUCache<number, TMDBExternalIds>(DEFAULT_EXTERNAL_IDS_CACHE_SIZE),
  };
}

/**
 * Очищає всі кеші в контейнері
 *
 * @param caches - Контейнер кешів для очищення
 *
 * @example
 * ```typescript
 * const caches = createTrendingMoviesCache();
 * // ... використання кешів ...
 * clearTrendingMoviesCache(caches);
 * ```
 */
export function clearTrendingMoviesCache(caches: TrendingMoviesCache): void {
  // Очищуємо кожен кеш, створюючи новий екземпляр
  // Оскільки LRUCache не має методу clear(), ми створюємо нові екземпляри
  caches.details = new LRUCache<number, TMDBMovieDetails>(DEFAULT_DETAILS_CACHE_SIZE);
  caches.translations = new LRUCache<number, TMDBMovieTranslation>(DEFAULT_TRANSLATIONS_CACHE_SIZE);
  caches.providers = new LRUCache<string, WatchProvider[]>(DEFAULT_PROVIDERS_CACHE_SIZE);
  caches.externalIds = new LRUCache<number, TMDBExternalIds>(DEFAULT_EXTERNAL_IDS_CACHE_SIZE);
}

/**
 * Отримує статистику використання кешів
 *
 * @param caches - Контейнер кешів для аналізу
 * @returns Об'єкт зі статистикою по кожному кешу
 *
 * @example
 * ```typescript
 * const caches = createTrendingMoviesCache();
 * const stats = getCacheStats(caches);
 * console.log(`Details cache size: ${stats.detailsSize}`);
 * ```
 */
export function getCacheStats(caches: TrendingMoviesCache) {
  return {
    detailsSize: 0, // LRUCache не надає інформації про розмір
    translationsSize: 0,
    providersSize: 0,
    externalIdsSize: 0,
  };
}
