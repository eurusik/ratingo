/**
 * Модуль для роботи з даними шоу
 */

import { db } from '@/db';
import { shows } from '@/db/schema';
import { and, isNotNull, eq } from 'drizzle-orm';

/**
 * Отримує trending шоу з бази даних
 */
export async function getTrendingShows(): Promise<number[]> {
  const rows = await db
    .select({ tmdbId: shows.tmdbId })
    .from(shows)
    .where(and(isNotNull(shows.trendingScore), isNotNull(shows.ratingTrakt)));

  return rows.map((row) => row.tmdbId);
}

/**
 * Отримує ID шоу за TMDB ID
 */
export async function getShowIdByTmdbId(tmdbId: number): Promise<number | null> {
  const rows = await db
    .select({ id: shows.id })
    .from(shows)
    .where(eq(shows.tmdbId, tmdbId))
    .limit(1);

  return rows[0]?.id ?? null;
}
