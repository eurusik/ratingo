/**
 * Модуль для роботи з рекомендаціями Trakt
 * @module trakt
 */

import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '../utils';
import { getBaseGenres, filterShowsByGenres } from './genres';
import type { TraktRelatedShow } from './types';

/**
 * Отримати рекомендації з Trakt з фільтрацією за жанрами
 * @param traktSlugOrId - Slug або ID шоу в Trakt
 * @param baseTmdbId - TMDB ID базового шоу для порівняння жанрів
 * @returns Проміс з масивом відфільтрованих TMDB ID
 */
export async function getTraktRecommendations(
  traktSlugOrId: string | number,
  baseTmdbId: number
): Promise<number[]> {
  try {
    const related = await withRetry(() => traktClient.getRelatedShows(traktSlugOrId, 12));

    if (!Array.isArray(related) || related.length === 0) {
      return [];
    }

    const idsRaw = Array.from(
      new Set(
        related
          .map((r: TraktRelatedShow) => r?.ids?.tmdb)
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)
      )
    );

    if (idsRaw.length === 0) {
      return [];
    }

    const baseGenres = await getBaseGenres(baseTmdbId);
    const genreLists = await Promise.all(
      idsRaw.map((id) => withRetry(() => tmdbClient.getShowGenres(id)).catch(() => []))
    );

    const showsWithGenres = idsRaw.map((id, idx) => ({
      id,
      genres: Array.isArray(genreLists[idx]) ? genreLists[idx] : [],
    }));

    return filterShowsByGenres(showsWithGenres, baseGenres).slice(0, 12);
  } catch {
    return [];
  }
}
