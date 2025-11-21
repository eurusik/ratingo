/**
 * @fileoverview Логіка обробки фільмів
 */

import { processMovie } from '@/lib/sync/movies/processing';
import type { SyncTask, MovieProcessingOptions, TraktMovieData } from './types';

/**
 * Підготувати Trakt дані з задачі
 *
 * @param task - Задача синхронізації
 * @returns Підготовлені Trakt дані
 *
 * @example
 * ```typescript
 * const traktData = prepareTraktData(task);
 * console.log('Watchers:', traktData.watchers);
 * ```
 */
export function prepareTraktData(task: SyncTask): TraktMovieData {
  const payload = task.payload || {};
  const watchers = typeof payload.watchers === 'number' ? payload.watchers : undefined;
  const movie = payload.traktMovie || { ids: { tmdb: task.tmdbId }, title: null };

  console.log('Prepared Trakt data:', { watchers, movie });
  return { watchers, movie };
}

/**
 * Розрахувати максимальну кількість watchers
 *
 * @param traktData - Trakt дані фільму
 * @returns Максимальна кількість watchers
 *
 * @example
 * ```typescript
 * const maxWatchers = calculateMaxWatchers(traktData);
 * console.log('Max watchers:', maxWatchers);
 * ```
 */
export function calculateMaxWatchers(traktData: TraktMovieData): number {
  const watchers = traktData?.watchers;
  return Math.max(10000, typeof watchers === 'number' ? watchers : 10000);
}

/**
 * Обробити фільм з усіма налаштуваннями
 *
 * @param task - Задача синхронізації
 * @param options - Параметри обробки
 * @returns Проміс з результатом обробки
 *
 * @example
 * ```typescript
 * const result = await processMovieTask(task, options);
 * if (result.error) {
 *   console.error('Processing failed:', result.error);
 * }
 * ```
 */
export async function processMovieTask(
  task: SyncTask,
  options: MovieProcessingOptions
): Promise<{ error?: string }> {
  const traktData = prepareTraktData(task);
  const maxWatchers = calculateMaxWatchers(traktData);

  return await processMovie(traktData, {
    ...options,
    maxWatchers,
  });
}
