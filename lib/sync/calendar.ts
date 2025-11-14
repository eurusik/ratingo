/**
 * Синхронізація календаря ефірів та очищення застарілих записів.
 *
 * @example
 * import { runCalendarSync, pruneStaleAirings } from '@/lib/sync/calendar';
 * const { processed, inserted, updated } = await runCalendarSync();
 * const { deleted } = await pruneStaleAirings();
 */
import { db } from '@/db';
import { shows, showAirings } from '@/db/schema';
import { traktClient } from '@/lib/api/trakt';
import { withRetry } from './utils';
import { eq, and, isNotNull, isNull, or } from 'drizzle-orm';

/**
 * Синхронізує ефіри з Trakt календаря для трендових шоу за вікно днів.
 *
 * @example
 * const res = await runCalendarSync();
 */
export async function runCalendarSync(
  trendingSetArg?: Set<number>
): Promise<{ processed: number; inserted: number; updated: number }> {
  let processed = 0;
  let inserted = 0;
  let updated = 0;

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const start = `${y}-${m}-${d}`;
  const daysEnv = parseInt(String(process.env.AIRINGS_CALENDAR_DAYS || '30'), 10);
  const days = Math.max(1, Math.min(30, Number.isFinite(daysEnv) ? daysEnv : 30));

  const trendingSet =
    trendingSetArg && trendingSetArg.size > 0
      ? trendingSetArg
      : new Set(
          (
            await db
              .select({ tmdbId: shows.tmdbId })
              .from(shows)
              .where(and(isNotNull(shows.trendingScore), isNotNull(shows.ratingTrakt)))
          ).map((r: any) => r.tmdbId)
        );

  const calendar = await withRetry(() => traktClient.getCalendarShows(start, days));
  for (const item of calendar) {
    try {
      const showDataCal = item?.show;
      const ep = item?.episode;
      const tmdbId = showDataCal?.ids?.tmdb;
      if (!tmdbId || !ep || !trendingSet.has(tmdbId)) continue;
      const season = ep?.season ?? null;
      const episode = ep?.number ?? null;
      const episodeTitle = ep?.title ?? null;
      const title = showDataCal?.title ?? null;
      const traktId = showDataCal?.ids?.trakt ?? null;
      const airDate = item?.first_aired ?? null;
      const network = (showDataCal as any)?.network ?? null;
      const existingShowRow = await db
        .select({ id: shows.id })
        .from(shows)
        .where(eq(shows.tmdbId, tmdbId))
        .limit(1);
      const showId = existingShowRow[0]?.id ?? null;
      processed++;
      const existingAiring = await db
        .select({ id: showAirings.id })
        .from(showAirings)
        .where(
          and(
            eq(showAirings.tmdbId, tmdbId),
            eq(showAirings.season, season),
            eq(showAirings.episode, episode)
          )
        )
        .limit(1);
      if (existingAiring.length > 0) {
        await db
          .update(showAirings)
          .set({
            showId,
            traktId,
            title,
            episodeTitle,
            airDate,
            network,
            type: 'episode',
            updatedAt: new Date(),
          })
          .where(eq(showAirings.id, existingAiring[0].id));
        updated++;
      } else {
        await db.insert(showAirings).values({
          showId,
          tmdbId,
          traktId,
          title,
          episodeTitle,
          season,
          episode,
          airDate,
          network,
          type: 'episode',
        });
        inserted++;
      }
    } catch {}
  }

  return { processed, inserted, updated };
}

/**
 * Видаляє ефіри, що не мають валідного шоу/тренда (очищення).
 *
 * @example
 * const res = await pruneStaleAirings();
 */
export async function pruneStaleAirings(): Promise<{ deleted: number }> {
  let deleted = 0;
  const stale = await db
    .select({ id: showAirings.id })
    .from(showAirings)
    .leftJoin(shows, eq(showAirings.showId, shows.id))
    .where(or(isNull(shows.id), isNull(shows.trendingScore), isNull(shows.ratingTrakt)))
    .limit(500);
  for (const row of stale) {
    await db.delete(showAirings).where(eq(showAirings.id, row.id));
  }
  deleted = stale.length;
  return { deleted };
}
