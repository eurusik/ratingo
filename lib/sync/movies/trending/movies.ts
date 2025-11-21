/**
 * @fileoverview Отримання та валідація трендових фільмів
 */

import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '@/lib/sync/utils';
import type { TraktTrendingMovie, TaskData } from './types';

/**
 * Отримати трендові фільми з Trakt API
 *
 * @param limit - Максимальна кількість фільмів для отримання
 * @returns Проміс з масивом трендових фільмів
 *
 * @example
 * ```typescript
 * const movies = await getTrendingMovies(100);
 * console.log('Fetched', movies.length, 'trending movies');
 * ```
 */
export async function getTrendingMovies(limit: number): Promise<TraktTrendingMovie[]> {
  return await withRetry(() => traktClient.getTrendingMovies(limit), 3, 300);
}

/**
 * Валідувати та витягнути TMDB ID з трендового фільму
 *
 * @param movie - Трендовий фільм з Trakt
 * @returns Валідний TMDB ID або null
 *
 * @example
 * ```typescript
 * const tmdbId = extractValidTmdbId(movie);
 * if (tmdbId) {
 *   console.log('Valid TMDB ID:', tmdbId);
 * }
 * ```
 */
export function extractValidTmdbId(movie: TraktTrendingMovie): number | null {
  const tmdbId = movie?.movie?.ids?.tmdb;
  if (typeof tmdbId !== 'number' || !Number.isFinite(tmdbId) || tmdbId <= 0) {
    return null;
  }
  return tmdbId;
}

/**
 * Конвертувати трендові фільми в дані для задач
 *
 * @param movies - Масив трендових фільмів
 * @param jobId - ID джоби
 * @returns Масив даних для створення задач
 *
 * @example
 * ```typescript
 * const taskData = convertMoviesToTaskData(movies, jobId);
 * console.log('Created', taskData.length, 'task entries');
 * ```
 */
export function convertMoviesToTaskData(movies: TraktTrendingMovie[], jobId: number): TaskData[] {
  return movies
    .map((movie) => {
      const tmdbId = extractValidTmdbId(movie);
      if (tmdbId === null) return null;

      const payload = {
        watchers: movie?.watchers ?? null,
        traktMovie: movie?.movie ?? null,
      };

      return {
        jobId,
        tmdbId,
        payload,
        status: 'pending' as const,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    })
    .filter(Boolean) as TaskData[];
}
