/**
 * Обчислення метрик шоу: трендові бали, дельти, рейтинги.
 *
 * @example
 * ```typescript
 * import { calculateTrendingScore, computeDeltas, fetchTraktRatings } from '@/lib/sync/shows/processing';
 * const score = calculateTrendingScore(8.5, 1500, 5000);
 * const deltas = await computeDeltas(123, 1500, 8.5, context);
 * const ratings = await fetchTraktRatings('breaking-bad', context);
 * ```
 */

import type { ProcessShowContext } from './types';
import { db } from '@/db';
import { shows, showWatchersSnapshots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRetry } from '@/lib/sync/utils';
import { traktClient } from '@/lib/api/trakt';

/**
 * Обчислює трендовий бал на основі TMDB рейтингу та кількості глядачів Trakt.
 *
 * @param tmdbVoteAverage Середній рейтинг TMDB
 * @param watchers Кількість глядачів Trakt
 * @param maxWatchers Максимальна кількість глядачів для нормалізації
 * @returns Трендовий бал від 0 до 100
 *
 * @example
 * ```typescript
 * const score = calculateTrendingScore(8.5, 1500, 5000);
 * ```
 */
export function calculateTrendingScore(
  tmdbVoteAverage: number,
  watchers: number,
  maxWatchers: number
): number {
  const ratingScore = Math.max(0, Math.min(10, tmdbVoteAverage)) * 5;
  const watchersScore = maxWatchers > 0 ? (watchers / maxWatchers) * 50 : 0;
  return Math.round(ratingScore + watchersScore);
}

/**
 * Обчислює дельти для трендових метрик: зміна глядачів за місяць та 3 місяці.
 *
 * @param tmdbId TMDB ID шоу
 * @param watchers Поточна кількість глядачів
 * @param tmdbVoteAverage TMDB рейтинг
 * @param ctx Контекст обробки
 * @returns Об'єкт з трендовим балом, дельтою за 3 місяці та зміною глядачів
 *
 * @example
 * ```typescript
 * const { trendingScore, delta3mVal, watchersDelta } = await computeDeltas(123, 1500, 8.5, context);
 * ```
 */
export async function computeDeltas(
  tmdbId: number,
  watchers: number,
  tmdbVoteAverage: number | null,
  ctx: ProcessShowContext
): Promise<{ trendingScore: number; delta3mVal: number; watchersDelta: number }> {
  const trendingScore = calculateTrendingScore(tmdbVoteAverage || 0, watchers, ctx.maxWatchers);

  const prevRow = await db
    .select({ ratingTraktPrev: shows.ratingTrakt })
    .from(shows)
    .where(eq(shows.tmdbId, tmdbId))
    .limit(1);

  const deltaPrev =
    typeof prevRow[0]?.ratingTraktPrev === 'number' ? watchers - prevRow[0].ratingTraktPrev : null;

  const deltaMonthly =
    typeof ctx.monthly.m0[tmdbId] === 'number' && typeof ctx.monthly.m1[tmdbId] === 'number'
      ? ctx.monthly.m0[tmdbId] - ctx.monthly.m1[tmdbId]
      : null;

  const sumRecent3 =
    (ctx.monthly.m0[tmdbId] || 0) + (ctx.monthly.m1[tmdbId] || 0) + (ctx.monthly.m2[tmdbId] || 0);
  const sumPrev3 =
    (ctx.monthly.m3[tmdbId] || 0) + (ctx.monthly.m4[tmdbId] || 0) + (ctx.monthly.m5[tmdbId] || 0);

  let delta3mVal = sumRecent3 - sumPrev3;

  if (delta3mVal === 0) {
    try {
      const snaps = await db
        .select({ watchers: showWatchersSnapshots.watchers })
        .from(showWatchersSnapshots)
        .where(eq(showWatchersSnapshots.tmdbId, tmdbId))
        .orderBy(showWatchersSnapshots.createdAt)
        .limit(6);

      if (Array.isArray(snaps) && snaps.length >= 4) {
        const recent = snaps
          .slice(0, 3)
          .reduce((sum: number, snapshot: any) => sum + (Number(snapshot.watchers) || 0), 0);
        const prev3 = snaps
          .slice(3, 6)
          .reduce((sum: number, snapshot: any) => sum + (Number(snapshot.watchers) || 0), 0);
        delta3mVal = recent - prev3;
      }
    } catch {}
  }

  return { trendingScore, delta3mVal, watchersDelta: deltaMonthly ?? deltaPrev ?? 0 };
}

/**
 * Отримує рейтинги з Trakt для шоу.
 *
 * @param traktSlugOrId Slug або ID шоу в Trakt
 * @param ctx Контекст обробки з функцією retry
 * @returns Об'єкт з середнім рейтингом, кількістю голосів та дистрибуцією
 *
 * @example
 * ```typescript
 * const { ratingTraktAvg, ratingTraktVotes, ratingDistribution } = await fetchTraktRatings('breaking-bad', context);
 * ```
 */
export async function fetchTraktRatings(
  traktSlugOrId: any,
  ctx: ProcessShowContext
): Promise<{
  ratingTraktAvg: number | null;
  ratingTraktVotes: number | null;
  ratingDistribution?: Record<string, number>;
}> {
  let ratingTraktAvg: number | null = null;
  let ratingTraktVotes: number | null = null;
  let ratingDistribution: Record<string, number> | undefined;

  try {
    const tr = await withRetry(
      () => traktClient.getShowRatings(traktSlugOrId),
      3,
      300,
      ctx.onRetryLabel('trakt.ratings')
    );
    ratingTraktAvg = typeof tr.rating === 'number' ? tr.rating : null;
    ratingTraktVotes = typeof tr.votes === 'number' ? tr.votes : null;
    ratingDistribution = tr.distribution as any;
  } catch {}

  return { ratingTraktAvg, ratingTraktVotes, ratingDistribution };
}
