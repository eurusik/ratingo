/**
 * Модуль для роботи з рекомендаціями TMDB
 * @module tmdb
 */

import { tmdbClient } from '@/lib/api/tmdb';
import { withRetry } from '../utils';
import { getBaseGenres, hasBannedGenres, filterByGenres } from './genres';

/**
 * Отримати рекомендації з TMDB з фільтрацією за жанрами
 * @param tmdbId - TMDB ID шоу для отримання рекомендацій
 * @returns Проміс з масивом відфільтрованих TMDB ID
 */
export async function getTmdbRecommendations(tmdbId: number): Promise<number[]> {
  try {
    const recs = await withRetry(() => tmdbClient.getRecommendations(tmdbId, 1));

    if (!recs || !Array.isArray(recs.results)) {
      return [];
    }

    const baseGenres = await getBaseGenres(tmdbId);
    const results = recs.results || [];

    const filtered = results
      .filter((r) => {
        if (!r?.id || !Array.isArray(r.genre_ids)) return false;

        const genreIds = r.genre_ids as number[];
        if (hasBannedGenres(genreIds)) return false;
        if (genreIds.length === 0) return true;

        return filterByGenres(genreIds, baseGenres);
      })
      .map((r) => r.id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0);

    return Array.from(new Set(filtered)).slice(0, 12);
  } catch {
    return [];
  }
}
