/**
 * @fileoverview Обробка окремих фільмів для trending movies
 *
 * Модуль відповідає за обробку кожного фільму окремо:
 * - отримання деталей з TMDB
 * - оновлення рейтингів та знімків
 * - робота з базою даних
 *
 * @author Твій Асистент
 */

import { processMovie } from '@/lib/sync/movies/processing';
import type { ProcessMovieResult } from '@/lib/sync/movies/processing/types';
import type { MovieProcessingOptions, MovieProcessingResult } from './types';

/**
 * Обробляє масив фільмів з обмеженням конкурентності
 *
 * @param movies - Масив фільмів для обробки
 * @param options - Параметри обробки
 * @param concurrency - Максимальна кількість одночасних процесів
 * @returns Масив результатів обробки
 *
 * @example
 * ```typescript
 * const results = await processMoviesBatch(movies, options, 3);
 * const successful = results.filter(r => !r.skipped);
 * console.log(`Успішно оброблено ${successful.length} фільмів`);
 * ```
 */
export async function processMoviesBatch(
  movies: any[],
  options: MovieProcessingOptions,
  concurrency: number = 6
): Promise<MovieProcessingResult[]> {
  const results: MovieProcessingResult[] = [];

  // Обробляємо партіями для контролю конкурентності
  for (let i = 0; i < movies.length; i += concurrency) {
    const batch = movies.slice(i, i + concurrency);
    const batchResults: ProcessMovieResult[] = await Promise.all(
      batch.map((movie) => processMovie(movie, options))
    );
    results.push(...batchResults.map((r) => ({ success: !r.error, ...r })));
  }

  return results;
}

/**
 * Агрегує результати обробки фільмів
 *
 * @param results - Масив результатів обробки
 * @returns Загальна статистика
 *
 * @example
 * ```typescript
 * const results = await processMoviesBatch(movies, options);
 * const stats = aggregateResults(results);
 * console.log(`Всього: ${stats.total}, Пропущено: ${stats.skipped}, Оновлено: ${stats.updated}`);
 * ```
 */
export function aggregateResults(results: MovieProcessingResult[]) {
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
