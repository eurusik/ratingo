import { db } from '@/db';
import {
  shows,
  showAirings,
  showRelated,
  showRatings,
  showRatingBuckets,
  showWatchersSnapshots,
  showTranslations,
  genres as genresTable,
  showGenres,
  showVideos,
  showWatchProviders,
  showCast,
  showContentRatings,
} from '@/db/schema';
import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { omdbClient } from '@/lib/api/omdb';
import { calculateTrendingScore } from '@/lib/utils';
import { eq, and, or, isNull, isNotNull, inArray, desc, sql } from 'drizzle-orm';
import { RunnerResult } from './types';
import { buildMonthlyMaps } from './monthly';
import { getRelatedTmdbIds } from './related';
import { asyncPool, withRetry, LRUCache, cachedWithRetry } from './utils';
import { processShow } from './processShow';
import { runOmdbBackfill, runMetaBackfill } from './backfill';
import { runCalendarSync, pruneStaleAirings } from './calendar';

// Helpers moved to ./types, ./monthly, ./related, and ./utils for clarity

export async function runTrendingSync(): Promise<RunnerResult> {
  const errors: string[] = [];
  let updated = 0;
  let added = 0;
  let skipped = 0;
  let relatedShowsInserted = 0;
  let relatedLinksAdded = 0;
  const relatedSourceCounts: { trakt: number; tmdb: number } = { trakt: 0, tmdb: 0 };
  let relatedCandidatesTotal = 0;
  let relatedShowsWithCandidates = 0;
  let calendarProcessed = 0;
  let calendarInserted = 0;
  let calendarUpdated = 0;
  let pruneDeleted = 0;
  let omdbBackfillUpdated = 0;
  let metaBackfillUpdated = 0;
  let ratingsUpdated = 0;
  let bucketsUpserted = 0;
  let snapshotsInserted = 0;
  let snapshotsUnchanged = 0;
  let snapshotsProcessed = 0;

  const perf = {
    phases: {
      trendingFetchMs: 0,
      monthlyMapsMs: 0,
      perShowAvgMs: 0,
      perShowMaxMs: 0,
      omdbBackfillMs: 0,
      metaBackfillMs: 0,
      calendarSyncMs: 0,
      pruneMs: 0,
    },
    retries: {} as Record<string, number>,
  };
  const retryCounts: Record<string, number> = {};
  const onRetryLabel = (label: string) => (attempt: number, _err: any) => {
    retryCounts[label] = (retryCounts[label] || 0) + 1;
  };
  const tmdbDetailsCache = new LRUCache<number, any>(600);
  const tmdbTranslationCache = new LRUCache<number, any>(600);
  const tmdbProvidersCache = new LRUCache<string, any[]>(800);
  const tmdbContentRatingCache = new LRUCache<string, any>(800);
  const tmdbExternalIdsCache = new LRUCache<number, any>(800);
  const perShowTimes: number[] = [];

  const ANIME_GENRE_ID = 16;
  const animeKeywords = ['anime', 'аніме'];
  const currentTrendingTmdbIds = new Set<number>();

  // 1) Fetch trending shows (Trakt)
  let traktData: any[] = [];
  try {
    const t0 = Date.now();
    traktData = await withRetry(
      () => traktClient.getTrendingShows(100),
      3,
      300,
      onRetryLabel('trakt.trending')
    );
    perf.phases.trendingFetchMs = Date.now() - t0;
  } catch (error) {
    throw new Error('Trakt API unavailable - cannot fetch trending data');
  }

  const maxWatchers = Math.max(...traktData.map((show) => show.watchers), 10000);

  // 2) Monthly watchers maps for deltas
  const tMonthly = Date.now();
  const monthly = await buildMonthlyMaps();
  perf.phases.monthlyMapsMs = Date.now() - tMonthly;

  // 3) Per-show processing з обмеженою конкуренцією
  await asyncPool(6, traktData, async (traktItem) => {
    const s0 = Date.now();
    const out = await processShow(traktItem, {
      monthly,
      maxWatchers,
      animeKeywords,
      tmdbDetailsCache,
      tmdbTranslationCache,
      tmdbProvidersCache,
      tmdbContentRatingCache,
      tmdbExternalIdsCache,
      currentTrendingTmdbIds,
      onRetryLabel,
    });
    if (out.skipped) {
      skipped++;
      perShowTimes.push(Date.now() - s0);
      return;
    }
    updated += out.updated;
    added += out.added;
    ratingsUpdated += out.ratingsUpdated;
    bucketsUpserted += out.bucketsUpserted;
    snapshotsInserted += out.snapshotsInserted;
    snapshotsUnchanged += out.snapshotsUnchanged;
    snapshotsProcessed += out.snapshotsProcessed;
    relatedShowsInserted += out.relatedShowsInserted;
    relatedLinksAdded += out.relatedLinksAdded;
    relatedSourceCounts.trakt += out.relatedSourceCounts.trakt;
    relatedSourceCounts.tmdb += out.relatedSourceCounts.tmdb;
    relatedCandidatesTotal += out.relatedCandidatesTotal;
    relatedShowsWithCandidates += out.relatedShowsWithCandidates;
    if (out.error) errors.push(out.error);
    perShowTimes.push(Date.now() - s0);
  });

  // Per-show timing stats
  if (perShowTimes.length) {
    const total = perShowTimes.reduce((s, x) => s + x, 0);
    perf.phases.perShowAvgMs = Math.round(total / perShowTimes.length);
    perf.phases.perShowMaxMs = Math.max(...perShowTimes);
  }

  // 4) OMDb backfill for cards
  const tOmdb = Date.now();
  try {
    const { updated: omdbUpd } = await runOmdbBackfill();
    omdbBackfillUpdated += omdbUpd;
  } catch (e) {
    errors.push('OMDb backfill failed');
  }
  perf.phases.omdbBackfillMs = Date.now() - tOmdb;

  // 5) Metadata backfill (TMDB basics)
  const tMeta = Date.now();
  try {
    const { updated: metaUpd } = await runMetaBackfill();
    metaBackfillUpdated += metaUpd;
  } catch {}
  perf.phases.metaBackfillMs = Date.now() - tMeta;

  // 6) Calendar sync (configurable days, restricted to synced trending set or DB trends)
  const tCal = Date.now();
  try {
    const { processed, inserted, updated: calUpd } = await runCalendarSync(currentTrendingTmdbIds);
    calendarProcessed += processed;
    calendarInserted += inserted;
    calendarUpdated += calUpd;
  } catch (e) {
    errors.push('Calendar sync failed');
  }
  perf.phases.calendarSyncMs = Date.now() - tCal;

  // 7) Prune stale airings
  const tPrune = Date.now();
  try {
    const { deleted } = await pruneStaleAirings();
    pruneDeleted += deleted;
  } catch (e) {
    errors.push('Airings prune failed');
  }
  perf.phases.pruneMs = Date.now() - tPrune;

  const result: RunnerResult = {
    success: true,
    updated,
    added,
    skipped,
    timestamp: new Date().toISOString(),
    totals: { trendingFetched: Array.isArray(traktData) ? traktData.length : null },
    related: {
      linksAdded: relatedLinksAdded,
      showsInserted: relatedShowsInserted,
      source: relatedSourceCounts,
      candidatesTotal: relatedCandidatesTotal,
      showsWithCandidates: relatedShowsWithCandidates,
    },
    ratings: { updated: ratingsUpdated, bucketsUpserted },
    prune: { airingsDeleted: pruneDeleted },
    backfill: { omdbUpdated: omdbBackfillUpdated, metaUpdated: metaBackfillUpdated },
    snapshots: {
      inserted: snapshotsInserted,
      unchanged: snapshotsUnchanged,
      processed: snapshotsProcessed,
    },
    perf: { phases: perf.phases, retries: retryCounts },
    ...(errors.length > 0 ? { errors, errorCount: errors.length } : {}),
  };
  try {
    console.log(
      `[trending-sync] related candidates: total=${relatedCandidatesTotal}, shows_with_candidates=${relatedShowsWithCandidates}; ` +
        `snapshots: inserted=${snapshotsInserted}, unchanged=${snapshotsUnchanged}, processed=${snapshotsProcessed}; ` +
        `updated=${updated}, added=${added}, skipped=${skipped}`
    );
  } catch {}
  return result;
}
