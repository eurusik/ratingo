/**
 * Модуль для обробки trending shows
 * @module trendingCoordinator/shows
 */

import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '@/lib/sync/utils';
import type { TraktTrendingShow } from './types';

/**
 * Отримати trending shows з Trakt API
 * @param limit - Максимальна кількість shows (за замовчуванням 100)
 * @returns Проміс з масивом trending shows
 */
export async function getTrendingShows(limit: number = 100): Promise<TraktTrendingShow[]> {
  const trending = await withRetry(() => traktClient.getTrendingShows(limit), 3, 300);
  return Array.isArray(trending) ? trending : [];
}

/**
 * Валідувати TMDB ID з trending show
 * @param show - Trending show дані
 * @returns Валідний TMDB ID або null
 */
export function extractValidTmdbId(show: TraktTrendingShow): number | null {
  const tmdbId = show?.show?.ids?.tmdb;

  if (typeof tmdbId !== 'number' || !Number.isFinite(tmdbId) || tmdbId <= 0) {
    return null;
  }

  return tmdbId;
}

/**
 * Перетворити trending shows в дані для створення tasks
 * @param shows - Масив trending shows
 * @param jobId - ID sync job
 * @returns Масив об'єктів для створення sync tasks
 */
export function convertShowsToTaskData(shows: TraktTrendingShow[], jobId: number) {
  return shows
    .map((show) => {
      const tmdbId = extractValidTmdbId(show);
      if (tmdbId === null) return null;

      const payload = {
        watchers: show?.watchers ?? null,
        traktShow: show?.show ?? null,
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
    .filter(Boolean) as Array<{
    jobId: number;
    tmdbId: number;
    payload: any;
    status: 'pending';
    attempts: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}
