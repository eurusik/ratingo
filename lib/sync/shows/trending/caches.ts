/**
 * @fileoverview Управління кешами для трендових шоу
 *
 * Модуль відповідає за створення та управління LRU кешами для даних TMDB:
 * - деталі шоу
 * - переклади
 * - провайдери перегляду
 * - зовнішні ID
 *
 * @author Твій Асистент
 */

import { LRUCache } from '@/lib/sync/utils';
import type {
  TMDBShowDetails,
  TMDBShowTranslation,
  WatchProvider,
  TMDBExternalIds,
} from '@/lib/types';
import type { TrendingShowsCache } from './types';

/**
 * Розмір кешу за замовчуванням для деталей шоу
 * Зберігає до 500 деталей шоу
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
 * Створює новий контейнер кешів для трендових шоу
 *
 * @returns Об'єкт з усіма необхідними кешами для обробки шоу
 *
 * @example
 * ```typescript
 * const caches = createTrendingShowsCache();
 * const details = caches.details.get(showId);
 * ```
 */
export function createTrendingShowsCache(): TrendingShowsCache {
  return {
    details: new LRUCache<number, TMDBShowDetails>(DEFAULT_DETAILS_CACHE_SIZE),
    translations: new LRUCache<number, TMDBShowTranslation>(DEFAULT_TRANSLATIONS_CACHE_SIZE),
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
 * const caches = createTrendingShowsCache();
 * // ... використання кешів ...
 * clearTrendingShowsCache(caches);
 * ```
 */
export function clearTrendingShowsCache(caches: TrendingShowsCache): void {
  // Очищуємо кожен кеш, створюючи новий екземпляр
  // Оскільки LRUCache не має методу clear(), ми створюємо нові екземпляри
  caches.details = new LRUCache<number, TMDBShowDetails>(DEFAULT_DETAILS_CACHE_SIZE);
  caches.translations = new LRUCache<number, TMDBShowTranslation>(DEFAULT_TRANSLATIONS_CACHE_SIZE);
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
 * const caches = createTrendingShowsCache();
 * const stats = getCacheStats(caches);
 * console.log(`Details cache size: ${stats.detailsSize}`);
 * ```
 */
export function getCacheStats(caches: TrendingShowsCache) {
  return {
    detailsSize: 0, // LRUCache не надає інформації про розмір
    translationsSize: 0,
    providersSize: 0,
    externalIdsSize: 0,
  };
}
