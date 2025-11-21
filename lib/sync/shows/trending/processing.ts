/**
 * @fileoverview Обробка окремих шоу для trending shows
 *
 * Модуль відповідає за обробку кожного шоу окремо:
 * - отримання деталей з TMDB
 * - оновлення рейтингів та знімків
 * - робота з базою даних
 *
 * @author Твій Асистент
 */

import type { ShowProcessingOptions, ShowProcessingResult } from './types';

/**
 * Обробляє окреме шоу
 *
 * @param showData - Дані шоу з Trakt
 * @param options - Параметри обробки (кеші, місячні мапи)
 * @returns Результат обробки шоу
 *
 * @example
 * ```typescript
 * const result = await processShow(traktShow, {
 *   monthly: monthlyMaps,
 *   maxWatchers: 10000,
 *   tmdbDetailsCache: caches.details,
 *   tmdbTranslationCache: caches.translations,
 *   tmdbProvidersCache: caches.providers,
 *   tmdbExternalIdsCache: caches.externalIds
 * });
 *
 * if (result.skipped) {
 *   console.log(`Шоу пропущено: ${traktShow.show.title}`);
 * }
 * ```
 */
export async function processShow(
  showData: any,
  options: ShowProcessingOptions
): Promise<ShowProcessingResult> {
  const {
    monthly,
    maxWatchers,
    tmdbDetailsCache,
    tmdbTranslationCache,
    tmdbProvidersCache,
    tmdbExternalIdsCache,
  } = options;

  try {
    const tmdbId = showData.show?.ids?.tmdb;
    if (!tmdbId) {
      return {
        success: false,
        skipped: true,
        updated: 0,
        added: 0,
        ratingsUpdated: 0,
        bucketsUpserted: 0,
        snapshotsInserted: 0,
        snapshotsUnchanged: 0,
        snapshotsProcessed: 0,
        error: 'Відсутній TMDB ID',
      };
    }

    // Перевіряємо кеші
    const cachedDetails = tmdbDetailsCache.get(tmdbId);
    const cachedTranslation = tmdbTranslationCache.get(tmdbId);
    const cachedProviders = tmdbProvidersCache.get(tmdbId.toString());
    const cachedExternalIds = tmdbExternalIdsCache.get(tmdbId);

    // Використовуємо глобальну функцію для обробки шоу
    const result = (await (global as any).processTrendingShow?.(showData, monthly, maxWatchers, {
      details: cachedDetails,
      translation: cachedTranslation,
      providers: cachedProviders,
      externalIds: cachedExternalIds,
    })) || {
      skipped: true,
      updated: 0,
      added: 0,
      ratingsUpdated: 0,
      bucketsUpserted: 0,
      snapshotsInserted: 0,
      snapshotsUnchanged: 0,
      snapshotsProcessed: 0,
    };

    return result;
  } catch (error) {
    return {
      success: false,
      skipped: true,
      updated: 0,
      added: 0,
      ratingsUpdated: 0,
      bucketsUpserted: 0,
      snapshotsInserted: 0,
      snapshotsUnchanged: 0,
      snapshotsProcessed: 0,
      error: error instanceof Error ? error.message : 'Невідома помилка',
    };
  }
}

/**
 * Обробляє масив шоу з обмеженням конкурентності
 *
 * @param shows - Масив шоу для обробки
 * @param options - Параметри обробки
 * @param concurrency - Максимальна кількість одночасних процесів
 * @returns Масив результатів обробки
 *
 * @example
 * ```typescript
 * const results = await processShowsBatch(shows, options, 3);
 * const successful = results.filter(r => !r.skipped);
 * console.log(`Успішно оброблено ${successful.length} шоу`);
 * ```
 */
export async function processShowsBatch(
  shows: any[],
  options: ShowProcessingOptions,
  concurrency: number = 6
): Promise<ShowProcessingResult[]> {
  const results: ShowProcessingResult[] = [];

  // Обробляємо партіями для контролю конкурентності
  for (let i = 0; i < shows.length; i += concurrency) {
    const batch = shows.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((show) => processShow(show, options)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Агрегує результати обробки шоу
 *
 * @param results - Масив результатів обробки
 * @returns Загальна статистика
 *
 * @example
 * ```typescript
 * const results = await processShowsBatch(shows, options);
 * const stats = aggregateResults(results);
 * console.log(`Всього: ${stats.total}, Пропущено: ${stats.skipped}, Оновлено: ${stats.updated}`);
 * ```
 */
export function aggregateResults(results: ShowProcessingResult[]) {
  return {
    total: results.length,
    skipped: results.filter((r) => r.skipped).length,
    updated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
    added: results.reduce((sum, r) => sum + (r.added || 0), 0),
    ratingsUpdated: results.reduce((sum, r) => sum + (r.ratingsUpdated || 0), 0),
    bucketsUpserted: results.reduce((sum, r) => sum + (r.bucketsUpserted || 0), 0),
    snapshotsInserted: results.reduce((sum, r) => sum + (r.snapshotsInserted || 0), 0),
    snapshotsUnchanged: results.reduce((sum, r) => sum + (r.snapshotsUnchanged || 0), 0),
    snapshotsProcessed: results.reduce((sum, r) => sum + (r.snapshotsProcessed || 0), 0),
    errors: results.filter((r) => r.error).length,
  };
}
