import { traktClient } from '@/lib/api/trakt';
import { RunnerResult } from './types';
import { buildMonthlyMapsMovies } from './monthly';
import { asyncPool, LRUCache, withRetry } from './utils';
import { processMovie } from './processMovie';

/**
 * Повний синк трендів фільмів: отримує тренди Trakt і обробляє
 * кожен фільм через `processMovie`, з кешами та обмеженням конкуренції.
 *
 * @example
 * import { runTrendingMoviesSync } from '@/lib/sync/trendingMovies';
 * const res = await runTrendingMoviesSync();
 * console.log(res.updated, res.added);
 */
export async function runTrendingMoviesSync(): Promise<RunnerResult> {
  const errors: string[] = [];
  let updated = 0;
  let added = 0;
  let ratingsUpdated = 0;
  let bucketsUpserted = 0;
  let snapshotsInserted = 0;
  let snapshotsUnchanged = 0;
  let snapshotsProcessed = 0;

  let traktData: any[] = [];
  try {
    traktData = await withRetry(() => traktClient.getTrendingMovies(100), 3, 300);
  } catch (error) {
    throw new Error('Trakt API unavailable - cannot fetch trending movies');
  }

  const maxWatchers = Math.max(...traktData.map((x: any) => x.watchers), 10000);
  const monthly = await buildMonthlyMapsMovies();
  const tmdbDetailsCache = new LRUCache<number, any>(600);
  const tmdbTranslationCache = new LRUCache<number, any>(600);
  const tmdbProvidersCache = new LRUCache<string, any[]>(800);
  const tmdbExternalIdsCache = new LRUCache<number, any>(800);

  await asyncPool(6, traktData, async (traktItem) => {
    try {
      const out = await processMovie(traktItem, {
        monthly,
        maxWatchers,
        tmdbDetailsCache,
        tmdbTranslationCache,
        tmdbProvidersCache,
        tmdbExternalIdsCache,
      });
      if (out.skipped) return;
      updated += out.updated;
      added += out.added;
      ratingsUpdated += out.ratingsUpdated;
      bucketsUpserted += out.bucketsUpserted;
      snapshotsInserted += out.snapshotsInserted;
      snapshotsUnchanged += out.snapshotsUnchanged;
      snapshotsProcessed += out.snapshotsProcessed;
      if (out.error) errors.push(out.error);
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }
  });

  const result: RunnerResult = {
    success: true,
    updated,
    added,
    skipped: 0,
    timestamp: new Date().toISOString(),
    totals: { trendingFetched: Array.isArray(traktData) ? traktData.length : null },
    ratings: { updated: ratingsUpdated, bucketsUpserted },
    snapshots: {
      inserted: snapshotsInserted,
      unchanged: snapshotsUnchanged,
      processed: snapshotsProcessed,
    },
    ...(errors.length > 0 ? { errors, errorCount: errors.length } : {}),
  } as any;
  return result;
}

export async function runTrendingMoviesIncremental(
  limit: number = 10,
  staleMinutes: number = 5
): Promise<RunnerResult & { processed: number }> {
  const errors: string[] = [];
  let updated = 0;
  let added = 0;
  let ratingsUpdated = 0;
  let bucketsUpserted = 0;
  let snapshotsInserted = 0;
  let snapshotsUnchanged = 0;
  let snapshotsProcessed = 0;

  let traktData: any[] = [];
  try {
    traktData = await withRetry(() => traktClient.getTrendingMovies(100), 3, 300);
  } catch (error) {
    throw new Error('Trakt API unavailable - cannot fetch trending movies');
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - Math.max(1, staleMinutes) * 60 * 1000);
  const tmdbIds = traktData.map((x: any) => Number(x?.movie?.ids?.tmdb || 0)).filter(Boolean);
  const { db } = await import('@/db');
  const { movies } = await import('@/db/schema');
  const { inArray } = await import('drizzle-orm');
  let existingRows: Array<{ tmdbId: number; trendingUpdatedAt: Date | null }> = [];
  if (tmdbIds.length) {
    existingRows = (await db
      .select({ tmdbId: movies.tmdbId, trendingUpdatedAt: movies.trendingUpdatedAt })
      .from(movies)
      .where(inArray(movies.tmdbId, tmdbIds))) as any[];
  }
  const byTmdb = new Map<number, Date | null>();
  for (const r of existingRows) byTmdb.set(Number(r.tmdbId), r.trendingUpdatedAt || null);
  const staleList = traktData.filter((x: any) => {
    const id = Number(x?.movie?.ids?.tmdb || 0);
    if (!id) return false;
    const last = byTmdb.get(id) || null;
    return !last || last < cutoff;
  });
  const toProcess = (staleList.length > 0 ? staleList : traktData).slice(
    0,
    Math.max(1, Math.min(50, limit))
  );

  const maxWatchers = Math.max(...traktData.map((x: any) => x.watchers), 10000);
  const monthly = await buildMonthlyMapsMovies();
  const tmdbDetailsCache = new LRUCache<number, any>(600);
  const tmdbTranslationCache = new LRUCache<number, any>(600);
  const tmdbProvidersCache = new LRUCache<string, any[]>(800);
  const tmdbExternalIdsCache = new LRUCache<number, any>(800);

  await asyncPool(6, toProcess, async (traktItem) => {
    try {
      const out = await processMovie(traktItem, {
        monthly,
        maxWatchers,
        tmdbDetailsCache,
        tmdbTranslationCache,
        tmdbProvidersCache,
        tmdbExternalIdsCache,
      });
      if (out.skipped) return;
      updated += out.updated;
      added += out.added;
      ratingsUpdated += out.ratingsUpdated;
      bucketsUpserted += out.bucketsUpserted;
      snapshotsInserted += out.snapshotsInserted;
      snapshotsUnchanged += out.snapshotsUnchanged;
      snapshotsProcessed += out.snapshotsProcessed;
      if (out.error) errors.push(out.error);
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }
  });

  const result: RunnerResult & { processed: number } = {
    success: true,
    updated,
    added,
    skipped: 0,
    timestamp: new Date().toISOString(),
    totals: { trendingFetched: Array.isArray(traktData) ? traktData.length : null },
    ratings: { updated: ratingsUpdated, bucketsUpserted },
    snapshots: {
      inserted: snapshotsInserted,
      unchanged: snapshotsUnchanged,
      processed: snapshotsProcessed,
    },
    processed: toProcess.length,
    ...(errors.length > 0 ? { errors, errorCount: errors.length } : {}),
  } as any;
  return result;
}
