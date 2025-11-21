/**
 * @fileoverview API функції для роботи з Trakt trending shows
 *
 * @module shows/trending/shows
 */

import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '@/lib/sync/utils';
import type { TraktTrendingShow } from '@/lib/types';
import type { TraktTrendingOptions } from './types';

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
 * Фільтрує валідні Trakt shows
 * @param shows - Масив trending shows
 * @returns Відфільтрований масив з валідними TMDB ID
 */
export function filterValidTraktShows(shows: TraktTrendingShow[]): TraktTrendingShow[] {
  return shows.filter((show) => extractValidTmdbId(show) !== null);
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
        tmdbId,
        jobId,
        status: 'pending' as const,
        payload,
      };
    })
    .filter(Boolean);
}
