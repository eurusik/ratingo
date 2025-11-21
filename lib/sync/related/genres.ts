/**
 * Модуль для роботи з жанрами шоу
 * @module genres
 */

import { tmdbClient } from '@/lib/api/tmdb';
import { withRetry } from '../utils';

/** Заборонені жанри (аніме, документальні, реаліті-шоу тощо) */
const BANNED_GENRES = new Set<number>([16, 99, 10764, 10767, 10763, 10766]);

/**
 * Отримати жанри шоу з TMDB
 * @param tmdbId - TMDB ID шоу
 * @returns Проміс з масивом ID жанрів
 */
export async function getBaseGenres(tmdbId: number): Promise<number[]> {
  const genres = await withRetry(() => tmdbClient.getShowGenres(tmdbId));
  return Array.isArray(genres) ? genres : [];
}

/**
 * Перевірити чи містить масив жанрів заборонені жанри
 * @param genres - Масив ID жанрів для перевірки
 * @returns true якщо є заборонені жанри, false якщо немає
 */
export function hasBannedGenres(genres: number[]): boolean {
  return genres.some((genre) => BANNED_GENRES.has(genre));
}

/**
 * Фільтрувати жанри за базовими жанрами
 * @param itemGenres - Жанри елемента для фільтрації
 * @param baseGenres - Базові жанри для порівняння
 * @returns true якщо є співпадіння жанрів, false якщо немає
 */
export function filterByGenres(itemGenres: number[], baseGenres: number[]): boolean {
  if (baseGenres.length === 0) return true;
  return itemGenres.some((genre) => baseGenres.includes(genre));
}

/**
 * Фільтрувати шоу за жанрами
 * @param shows - Масив шоу з жанрами
 * @param baseGenres - Базові жанри для фільтрації
 * @returns Масив ID відфільтрованих шоу
 */
export function filterShowsByGenres(
  shows: Array<{ id: number; genres?: number[] }>,
  baseGenres: number[]
): number[] {
  return shows
    .filter((show) => {
      const genres = show.genres || [];
      if (hasBannedGenres(genres)) return false;
      if (genres.length === 0) return true;
      return filterByGenres(genres, baseGenres);
    })
    .map((show) => show.id);
}
