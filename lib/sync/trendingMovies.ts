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
