/**
 * Головний модуль бекфілу, що надає єдину точку входу для всіх операцій оновлення даних.
 *
 * Цей модуль діє як тонкий агрегатор, делегуючи виклики до спеціалізованих модулів:
 * - OMDb рейтинги (@/lib/sync/shows/backfill/omdb)
 * - Метадані серіалів (@/lib/sync/shows/backfill/show)
 * - Метадані фільмів (@/lib/sync/movies/backfill)
 *
 * Використовує динамічні імпорти для лінивого завантаження модулів тільки при необхідності,
 * що покращує продуктивність додатку.
 */

import type {
  BackfillOmdbStats,
  BackfillShowsMetaStats,
  BackfillMoviesMetaStats,
} from '@/lib/types';

/**
 * Запускає бекфіл рейтингів з OMDb.
 *
 * @returns Об'єкт з кількістю оновлених записів та статистикою операції
 */
export async function runOmdbBackfill(): Promise<{ updated: number; stats: BackfillOmdbStats }> {
  const omdbModule = await import('./shows/backfill/omdb');
  return omdbModule.runOmdbBackfill();
}

/**
 * Запускає бекфіл метаданих для всіх серіалів.
 *
 * @returns Об'єкт з кількістю оновлених записів та статистикою операції
 */
export async function runMetaBackfill(): Promise<{
  updated: number;
  stats: BackfillShowsMetaStats;
}> {
  const showModule = await import('./shows/backfill/show');
  return showModule.runMetaBackfill();
}

/**
 * Запускає бекфіл метаданих для конкретного серіалу.
 *
 * @param showId Ідентифікатор серіалу для оновлення
 * @returns Об'єкт з кількістю оновлених записів та статистикою операції
 */
export async function backfillShowMetaById(
  showId: number
): Promise<{ updated: number; stats: BackfillShowsMetaStats }> {
  const showModule = await import('./shows/backfill/show');
  return showModule.backfillShowMetaById(showId);
}

/**
 * Запускає бекфіл метаданих для всіх фільмів.
 *
 * @returns Об'єкт з кількістю оновлених записів та статистикою операції
 */
export async function runMovieMetaBackfill(): Promise<{
  updated: number;
  stats: BackfillMoviesMetaStats;
}> {
  const moviesModule = await import('./movies/backfill');
  return moviesModule.runMovieMetaBackfill();
}
