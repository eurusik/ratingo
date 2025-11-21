/**
 * Модуль обробки завдань для трендових шоу
 * Керує трансформацією та обробкою окремих завдань
 *
 * @module taskProcessor
 * @example
 * import { processTrendingTask } from '@/lib/sync/trendingProcessor/tasks';
 * const result = await processTrendingTask(task, cache, monthly);
 */

import type { TraktTrendingShow } from '@/lib/types';
import { processShow } from '@/lib/sync/shows/processing';
import type { TrendingCache, TaskProcessorConfig, TaskProcessingResult } from './types';

/**
 * Трансформує payload завдання у формат Trakt trending show
 *
 * @param payload - Сирий payload завдання
 * @param tmdbId - TMDB ID з завдання
 * @returns Трансформований об'єкт Trakt trending show
 * @example
 * const traktItem = transformToTraktItem(task.payload, task.tmdbId);
 */
export function transformToTraktItem(payload: any, tmdbId: number): TraktTrendingShow {
  const p = payload || {};
  const watchers = typeof p?.watchers === 'number' ? p.watchers : undefined;
  const show = p?.traktShow || { ids: { tmdb: tmdbId }, title: null };

  return {
    watchers,
    show,
  } as TraktTrendingShow;
}

/**
 * Обчислює максимальний поріг глядачів для обробки
 *
 * @param watchers - Поточна кількість глядачів
 * @param defaultThreshold - Типовий мінімальний поріг
 * @returns Обчислений максимальний поріг глядачів
 * @example
 * const maxWatchers = calculateMaxWatchers(traktItem.watchers, 10000);
 */
export function calculateMaxWatchers(
  watchers: number | undefined,
  defaultThreshold: number = 10000
): number {
  return Math.max(defaultThreshold, typeof watchers === 'number' ? watchers : defaultThreshold);
}

/**
 * Обробляє окреме трендове завдання з усіма необхідними даними та кешуванням
 *
 * @param task - Дані завдання з payload та метаданими
 * @param config - Конфігурація обробки
 * @returns Результат обробки
 * @example
 * const result = await processTrendingTask(task, {
 *   monthly,
 *   cache,
 *   maxWatchers: 15000,
 * });
 */
export async function processTrendingTask(
  task: { payload: any; tmdbId: number },
  config: TaskProcessorConfig
): Promise<TaskProcessingResult> {
  try {
    const traktItem = transformToTraktItem(task.payload, task.tmdbId);
    const maxWatchers = calculateMaxWatchers(traktItem.watchers, config.maxWatchers);

    const onRetryLabel = config.onRetryLabel || (() => () => {});

    const result = await processShow(traktItem, {
      monthly: config.monthly,
      maxWatchers,
      animeKeywords: config.animeKeywords || ['аніме', 'anime'],
      tmdbDetailsCache: config.cache.details,
      tmdbTranslationCache: config.cache.translations,
      tmdbProvidersCache: config.cache.providers,
      tmdbContentRatingCache: config.cache.contentRatings,
      tmdbExternalIdsCache: config.cache.externalIds,
      currentTrendingTmdbIds: config.cache.currentTrending,
      onRetryLabel,
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Створює типовий обробник міток повторних спроб для обробки завдань
 *
 * @param label - Мітка для операції повторної спроби
 * @returns Функція обробника повторних спроб
 * @example
 * const onRetry = createRetryLabelHandler('TMDB API');
 * processShow(traktItem, { onRetryLabel: () => onRetry });
 */
export function createRetryLabelHandler(label: string): (attempt: number, err: any) => void {
  return (attempt: number, err: any) => {
    // Типова реалізація - можна налаштувати
    console.debug(`Повторна спроба ${attempt} для ${label}:`, err);
  };
}
