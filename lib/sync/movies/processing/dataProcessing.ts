/**
 * Обробка даних для фільмів.
 * Містить функції для формування записів фільмів та обчислення метрик.
 */

import { db } from '@/db';
import { movies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { calculateTrendingScore } from '@/lib/utils';

/**
 * Обчислює метрики для фільму: трендовий скор, дельти глядачів.
 *
 * @param tmdbId TMDB ID фільму
 * @param watchers Поточна кількість глядачів
 * @param tmdbVoteAverage Рейтинг з TMDB
 * @param ctx Контекст обробки з кешами та мапами
 * @returns Об'єкт з обчисленими метриками
 *
 * @example
 * ```typescript
 * const { trendingScore, delta3mVal, watchersDelta } = await computeMovieMetrics(
 *   tmdbId,
 *   watchers,
 *   details.vote_average,
 *   ctx
 * );
 * ```
 */
export async function computeMovieMetrics(
  tmdbId: number,
  watchers: number,
  tmdbVoteAverage: number | null,
  ctx: { monthly: any; maxWatchers: number }
): Promise<{ trendingScore: number; delta3mVal: number; watchersDelta: number }> {
  const trendingScore = calculateTrendingScore(
    Number(tmdbVoteAverage || 0),
    Number(watchers || 0),
    ctx.maxWatchers
  );

  const prevRow = await db
    .select({ ratingTraktPrev: movies.ratingTrakt })
    .from(movies)
    .where(eq(movies.tmdbId, tmdbId))
    .limit(1);

  const previousWatchers =
    typeof prevRow[0]?.ratingTraktPrev === 'number' ? Number(prevRow[0].ratingTraktPrev) : null;
  const watchersCount = Number(watchers || 0);
  const watchersDelta = previousWatchers !== null ? watchersCount - previousWatchers : 0;

  const sumRecentThreeMonths =
    (ctx.monthly.m0[tmdbId] || 0) + (ctx.monthly.m1[tmdbId] || 0) + (ctx.monthly.m2[tmdbId] || 0);
  const sumPreviousThreeMonths =
    (ctx.monthly.m3[tmdbId] || 0) + (ctx.monthly.m4[tmdbId] || 0) + (ctx.monthly.m5[tmdbId] || 0);
  const deltaThreeMonths = sumRecentThreeMonths - sumPreviousThreeMonths;

  return {
    trendingScore,
    delta3mVal: deltaThreeMonths,
    watchersDelta,
  };
}
