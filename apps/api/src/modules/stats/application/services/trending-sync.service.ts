import { Inject, Injectable, Logger } from '@nestjs/common';

import { MAX_PAGE_SIZE, MS_PER_MINUTE } from '@/common/constants';
import { MediaType } from '@/common/enums/media-type.enum';

import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import { ScoreCalculatorService } from '../../../shared/score-calculator';
import {
  type TraktListsPort,
  TRAKT_LISTS_PORT,
  type TraktRatingsPort,
  TRAKT_RATINGS_PORT,
} from '../../../trakt/public';
import {
  type IStatsRepository,
  type MediaStatsData,
  STATS_REPOSITORY,
} from '../../domain/repositories/stats.repository.interface';
import {
  type TrendingSyncOptions,
  type WatchersAggregationResult,
} from '../../domain/types/stats.types';
import { toScoreInput } from '../helpers';

// Stats sync constants
const SAFETY_WINDOW_MINUTES = 5;
const SAFETY_WINDOW_MS = SAFETY_WINDOW_MINUTES * MS_PER_MINUTE;
const NOT_FOUND_EXAMPLES_LIMIT = 5;
const DEFAULT_ELIGIBLE_BATCH_SIZE = 50;

/** Watchers lookup result: number (incl. 0) = success, undefined = not found, null = transient error */
type WatchersResult = number | null | undefined;

/**
 * Composite key for a media item. TMDB movie and TV id spaces overlap, so tmdbId alone is
 * NOT unique — (type, tmdb_id) is. All in-memory maps in this service use this key.
 */
const mediaKey = (type: string, tmdbId: number): string => `${type}:${tmdbId}`;

/**
 * Service for syncing trending stats from Trakt.
 */
@Injectable()
export class TrendingSyncService {
  private readonly logger = new Logger(TrendingSyncService.name);

  constructor(
    @Inject(TRAKT_LISTS_PORT)
    private readonly traktListsPort: TraktListsPort,

    @Inject(TRAKT_RATINGS_PORT)
    private readonly traktRatingsPort: TraktRatingsPort,

    private readonly scoreCalculator: ScoreCalculatorService,

    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,

    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Clears trending_rank and trending_score for items not updated since `before`.
   * Removes stale trending data from items that dropped out of TMDB trending.
   *
   * @param {Date} before - Cutoff date
   * @returns {Promise<number>} Number of items cleared
   */
  async clearStaleTrendingRanks(before: Date): Promise<number> {
    this.logger.log(`Clearing stale trending ranks (before: ${before.toISOString()})...`);

    const cleared = await this.mediaRepository.clearStaleTrendingRanks(before);

    this.logger.log(`Cleared ${cleared} stale trending ranks`);
    return cleared;
  }

  /**
   * Syncs trending stats from Trakt API using batch operations.
   * Fetches current watchers count and trending rank for movies and shows,
   * then updates the media_stats table for items that exist in our database.
   *
   * Optimized: Uses 3 batch queries instead of N*3 individual queries.
   *
   * @param {number} limit - Number of trending items to fetch per type
   * @returns {Promise<{ movies: number; shows: number }>} Count of updated items
   */
  async syncTrendingStats(limit = MAX_PAGE_SIZE): Promise<{ movies: number; shows: number }> {
    this.logger.log(`Syncing trending stats (limit: ${limit})...`);

    // Fetch trending from Trakt (parallel)
    const [trendingMovies, trendingShows] = await Promise.all([
      this.traktListsPort.getTrendingMoviesWithWatchers(limit),
      this.traktListsPort.getTrendingShowsWithWatchers(limit),
    ]);

    // Combine all trending items
    const allTrending = [
      ...trendingMovies.map((m) => ({ ...m, type: MediaType.MOVIE })),
      ...trendingShows.map((s) => ({ ...s, type: MediaType.SHOW })),
    ];

    if (allTrending.length === 0) {
      this.logger.log('No trending items to sync');
      return { movies: 0, shows: 0 };
    }

    // Batch: Get all media items by TMDB IDs (1 query)
    const tmdbIds = allTrending.map((t) => t.tmdbId);
    const mediaItems = await this.mediaRepository.findManyByTmdbIds(tmdbIds);
    const mediaMap = new Map(mediaItems.map((m) => [mediaKey(m.type, m.tmdbId), m.id]));

    // Filter to only items we have in DB
    const existingTrending = allTrending.filter((t) => mediaMap.has(mediaKey(t.type, t.tmdbId)));

    if (existingTrending.length === 0) {
      this.logger.log('No matching media items in database');
      return { movies: 0, shows: 0 };
    }

    // Batch: Get score data for all existing items (1 query)
    const mediaIds = existingTrending.map((t) => mediaMap.get(mediaKey(t.type, t.tmdbId))!);
    const scoreDataList = await this.mediaRepository.findManyForScoring(mediaIds);
    const scoreDataMap = new Map(scoreDataList.map((s) => [mediaKey(s.type, s.tmdbId), s]));

    // Calculate scores and prepare batch upsert
    const statsToUpsert: MediaStatsData[] = [];

    for (const item of existingTrending) {
      const key = mediaKey(item.type, item.tmdbId);
      const mediaId = mediaMap.get(key)!;
      const scoreData = scoreDataMap.get(key);

      const scores = scoreData
        ? this.scoreCalculator.calculate(toScoreInput(scoreData, item.watchers))
        : null;

      statsToUpsert.push({
        mediaItemId: mediaId,
        watchersCount: item.watchers,
        trendingRank: item.rank,
        ratingoScore: scores?.ratingoScore,
        qualityScore: scores?.qualityScore,
        popularityScore: scores?.popularityScore,
        freshnessScore: scores?.freshnessScore,
      });
    }

    // Batch: Upsert all stats (1 query)
    await this.statsRepository.bulkUpsert(statsToUpsert);

    const moviesUpdated = existingTrending.filter((t) => t.type === MediaType.MOVIE).length;
    const showsUpdated = existingTrending.filter((t) => t.type === MediaType.SHOW).length;

    this.logger.log(`Synced stats: ${moviesUpdated} movies, ${showsUpdated} shows`);
    return { movies: moviesUpdated, shows: showsUpdated };
  }

  /**
   * Syncs stats for items that were recently updated by trending sync.
   *
   * Flow:
   * 1. Get items from DB by trendingUpdatedAt (what we synced)
   * 2. Fetch watchers from Trakt by TMDB IDs (batch with concurrency)
   * 3. Calculate scores and update stats
   *
   * This ensures 100% consistency: stats are synced for exactly the items
   * that were updated by trending sync, not just items in Trakt trending list.
   *
   * @param {TrendingSyncOptions} options - Sync options
   * @returns {Promise<{ movies: number; shows: number }>} Count of updated items
   */
  async syncTrendingStatsForUpdatedItems(
    options: TrendingSyncOptions,
  ): Promise<{ movies: number; shows: number }> {
    // Apply safety window: since - 5 minutes to handle clock skew/delays
    const adjustedSince = options.since
      ? new Date(options.since.getTime() - SAFETY_WINDOW_MS)
      : undefined;

    this.logger.log(
      `Syncing stats for trending updated items (since: ${adjustedSince?.toISOString() || 'all'}, limit: ${options.limit})...`,
    );

    // 1. Get items from DB that were recently updated by trending sync
    const dbItems = await this.mediaRepository.findTrendingUpdatedItems({
      since: adjustedSince,
      limit: options.limit,
    });

    if (dbItems.length === 0) {
      this.logger.log('No trending updated items found in DB');
      return { movies: 0, shows: 0 };
    }

    // Separate by type
    const movieItems = dbItems.filter((i) => i.type === MediaType.MOVIE);
    const showItems = dbItems.filter((i) => i.type === MediaType.SHOW);

    this.logger.log(
      `Found ${dbItems.length} trending updated items in DB (${movieItems.length} movies, ${showItems.length} shows)`,
    );

    // 2. Fetch watchers from Trakt by TMDB IDs (batch with concurrency limit)
    const [movieWatchers, showWatchers] = await Promise.all([
      this.traktRatingsPort.getMovieWatchersByTmdbIds(movieItems.map((i) => i.tmdbId)),
      this.traktRatingsPort.getShowWatchersByTmdbIds(showItems.map((i) => i.tmdbId)),
    ]);

    // Merge watchers maps (keyed by type:tmdbId — movie and show ids overlap)
    const watchersMap = this.mergeWatchers(movieWatchers, showWatchers);

    // Aggregate results for logging
    const { fetched, skipped, notFound, notFoundExamples } = this.aggregateWatchersResults(
      watchersMap,
      dbItems,
    );

    this.logger.log(
      `Trakt watchers: requested=${dbItems.length}, fetched=${fetched}, skipped=${skipped}, notFound=${notFound}`,
    );

    // Log notFound examples for debugging Trakt matching issues
    if (notFoundExamples.length > 0) {
      this.logger.debug(`Trakt notFound examples: ${JSON.stringify(notFoundExamples)}`);
    }

    // 3. Get score data for items we'll update (only those with successful fetch)
    // typeof === 'number' ensures we exclude both null (error) and undefined (not found)
    const itemsToUpdate = dbItems.filter(
      (i) => typeof watchersMap.get(mediaKey(i.type, i.tmdbId)) === 'number',
    );
    const scoreDataList = await this.mediaRepository.findManyForScoring(
      itemsToUpdate.map((i) => i.id),
    );
    const scoreDataMap = new Map(scoreDataList.map((s) => [mediaKey(s.type, s.tmdbId), s]));

    // 4. Build stats to upsert (skip items with null watchers to preserve old data)
    const statsToUpsert: MediaStatsData[] = [];

    for (const item of itemsToUpdate) {
      const key = mediaKey(item.type, item.tmdbId);
      const watchers = watchersMap.get(key)! as number; // Not null, we filtered above
      const scoreData = scoreDataMap.get(key);

      const scores = scoreData
        ? this.scoreCalculator.calculate(toScoreInput(scoreData, watchers))
        : null;

      statsToUpsert.push({
        mediaItemId: item.id,
        watchersCount: watchers,
        ratingoScore: scores?.ratingoScore,
        qualityScore: scores?.qualityScore,
        popularityScore: scores?.popularityScore,
        freshnessScore: scores?.freshnessScore,
      });
    }

    // Batch upsert (idempotent)
    await this.statsRepository.bulkUpsert(statsToUpsert);

    const moviesUpdated = itemsToUpdate.filter((i) => i.type === MediaType.MOVIE).length;
    const showsUpdated = itemsToUpdate.filter((i) => i.type === MediaType.SHOW).length;

    this.logger.log(
      `Synced stats: ${moviesUpdated} movies, ${showsUpdated} shows (${skipped} skipped due to errors)`,
    );
    return { movies: moviesUpdated, shows: showsUpdated };
  }

  /**
   * Merges per-type watchers maps (tmdbId -> result) into one map keyed by `type:tmdbId`.
   * A single tmdbId-keyed map would let a show silently overwrite a movie with the same id.
   */
  private mergeWatchers(
    movieWatchers: Map<number, WatchersResult>,
    showWatchers: Map<number, WatchersResult>,
  ): Map<string, WatchersResult> {
    const merged = new Map<string, WatchersResult>();
    for (const [tmdbId, watchers] of movieWatchers) {
      merged.set(mediaKey(MediaType.MOVIE, tmdbId), watchers);
    }
    for (const [tmdbId, watchers] of showWatchers) {
      merged.set(mediaKey(MediaType.SHOW, tmdbId), watchers);
    }
    return merged;
  }

  /**
   * Aggregates watchers results for logging purposes.
   *
   * Semantics:
   * - number (including 0) = fetched successfully
   * - undefined = not found in Trakt (item doesn't exist there)
   * - null = transient error (429/5xx), skipped DB update
   *
   * @param watchersMap - Results keyed by `type:tmdbId`
   */
  private aggregateWatchersResults(
    watchersMap: Map<string, WatchersResult>,
    dbItems: { tmdbId: number; type: string }[],
  ): WatchersAggregationResult {
    let fetched = 0;
    let skipped = 0;
    let notFound = 0;
    const notFoundExamples: { tmdbId: number; type: string }[] = [];

    for (const [key, watchers] of watchersMap) {
      if (watchers === null) {
        // Transient error (429/5xx) - skip DB update
        skipped++;
        continue;
      }

      if (watchers === undefined) {
        // Not found in Trakt
        notFound++;
        this.collectNotFoundExample(key, dbItems, notFoundExamples);
        continue;
      }

      // number (including 0) = successful fetch
      fetched++;
    }

    return { fetched, skipped, notFound, notFoundExamples };
  }

  /**
   * Collects not-found examples for debugging (up to limit).
   */
  private collectNotFoundExample(
    key: string,
    dbItems: { tmdbId: number; type: string }[],
    notFoundExamples: { tmdbId: number; type: string }[],
  ): void {
    if (notFoundExamples.length >= NOT_FOUND_EXAMPLES_LIMIT) return;

    const item = dbItems.find((i) => mediaKey(i.type, i.tmdbId) === key);
    if (item) {
      notFoundExamples.push({ tmdbId: item.tmdbId, type: item.type });
    }
  }

  /**
   * Syncs watchers stats for ELIGIBLE items in trending context.
   *
   * Flow:
   * 1. Get ELIGIBLE items from DB with pagination
   * 2. Fetch watchers from Trakt by TMDB IDs (batch with concurrency)
   * 3. Calculate scores and update stats
   *
   * Used to backfill watchers data for items that are already in the trending list
   * but have watchers_count=0 (e.g., items that were never in Trakt trending top-100).
   *
   * @param {object} options - Sync options
   * @param {number} options.batchSize - Number of items per batch (default: 50)
   * @param {string} options.afterId - Keyset cursor: only items with id greater than this (default: from start)
   * @returns {Promise<{ movies: number; shows: number; total: number; hasMore: boolean; lastId?: string }>} Sync result (lastId = cursor for the next batch)
   */
  async syncEligibleTrendingStats(options: {
    batchSize?: number;
    afterId?: string;
  }): Promise<{
    movies: number;
    shows: number;
    total: number;
    hasMore: boolean;
    lastId?: string;
  }> {
    const batchSize = options.batchSize ?? DEFAULT_ELIGIBLE_BATCH_SIZE;
    const { afterId } = options;

    this.logger.log(
      `Syncing eligible trending stats (batchSize: ${batchSize}, afterId: ${afterId ?? 'start'})...`,
    );

    // 1. Get ELIGIBLE items with pagination (+1 to detect hasMore)
    const eligibleItems = await this.mediaRepository.findEligibleForTrending({
      limit: batchSize + 1,
      afterId,
    });

    const hasMore = eligibleItems.length > batchSize;
    const items = hasMore ? eligibleItems.slice(0, batchSize) : eligibleItems;

    if (items.length === 0) {
      this.logger.log('No eligible trending items found');
      return { movies: 0, shows: 0, total: 0, hasMore: false };
    }

    // Separate by type
    const movieItems = items.filter((i) => i.type === MediaType.MOVIE);
    const showItems = items.filter((i) => i.type === MediaType.SHOW);

    this.logger.log(
      `Found ${items.length} eligible trending items (${movieItems.length} movies, ${showItems.length} shows)`,
    );

    // 2. Fetch watchers from Trakt by TMDB IDs (batch with concurrency limit)
    const [movieWatchers, showWatchers] = await Promise.all([
      this.traktRatingsPort.getMovieWatchersByTmdbIds(movieItems.map((i) => i.tmdbId)),
      this.traktRatingsPort.getShowWatchersByTmdbIds(showItems.map((i) => i.tmdbId)),
    ]);

    // Merge watchers maps (keyed by type:tmdbId — movie and show ids overlap)
    const watchersMap = this.mergeWatchers(movieWatchers, showWatchers);

    // Aggregate results for logging
    const { fetched, skipped, notFound, notFoundExamples } = this.aggregateWatchersResults(
      watchersMap,
      items,
    );

    this.logger.log(
      `Trakt watchers: requested=${items.length}, fetched=${fetched}, skipped=${skipped}, notFound=${notFound}`,
    );

    if (notFoundExamples.length > 0) {
      this.logger.debug(`Trakt notFound examples: ${JSON.stringify(notFoundExamples)}`);
    }

    // 3. Get score data for items we'll update (only those with successful fetch)
    const itemsToUpdate = items.filter(
      (i) => typeof watchersMap.get(mediaKey(i.type, i.tmdbId)) === 'number',
    );
    const scoreDataList = await this.mediaRepository.findManyForScoring(
      itemsToUpdate.map((i) => i.id),
    );
    const scoreDataMap = new Map(scoreDataList.map((s) => [mediaKey(s.type, s.tmdbId), s]));

    // 4. Build stats to upsert (skip items with null watchers to preserve old data)
    const statsToUpsert: MediaStatsData[] = [];

    for (const item of itemsToUpdate) {
      const key = mediaKey(item.type, item.tmdbId);
      const watchers = watchersMap.get(key)! as number; // Not null, we filtered above
      const scoreData = scoreDataMap.get(key);

      const scores = scoreData
        ? this.scoreCalculator.calculate(toScoreInput(scoreData, watchers))
        : null;

      statsToUpsert.push({
        mediaItemId: item.id,
        watchersCount: watchers,
        ratingoScore: scores?.ratingoScore,
        qualityScore: scores?.qualityScore,
        popularityScore: scores?.popularityScore,
        freshnessScore: scores?.freshnessScore,
      });
    }

    // Batch upsert (idempotent)
    if (statsToUpsert.length > 0) {
      await this.statsRepository.bulkUpsert(statsToUpsert);
    }

    const moviesUpdated = itemsToUpdate.filter((i) => i.type === MediaType.MOVIE).length;
    const showsUpdated = itemsToUpdate.filter((i) => i.type === MediaType.SHOW).length;

    this.logger.log(
      `Synced eligible trending stats: ${moviesUpdated} movies, ${showsUpdated} shows (${skipped} skipped due to errors), hasMore=${hasMore}`,
    );

    return {
      movies: moviesUpdated,
      shows: showsUpdated,
      total: moviesUpdated + showsUpdated,
      hasMore,
      // Cursor covers the whole fetched batch (including skipped items) so the caller never re-reads it.
      lastId: items[items.length - 1].id,
    };
  }

  /** Refreshes watchers and scores for hero candidates with stale stats. */
  async syncHeroCandidatesStats(options: {
    staleThresholdHours: number;
    limit: number;
    minQualityScore?: number;
  }): Promise<{ movies: number; shows: number; total: number }> {
    this.logger.log(
      `Syncing homepage candidates stats (staleThreshold: ${options.staleThresholdHours}h, limit: ${options.limit}, minQuality: ${options.minQualityScore ?? 'default'})...`,
    );

    const candidates = await this.mediaRepository.findHeroCandidatesForStatsRefresh({
      staleThresholdHours: options.staleThresholdHours,
      limit: options.limit,
      minQualityScore: options.minQualityScore,
    });

    if (candidates.length === 0) {
      this.logger.log('No stale hero candidates found');
      return { movies: 0, shows: 0, total: 0 };
    }

    const movieItems = candidates.filter((i) => i.type === MediaType.MOVIE);
    const showItems = candidates.filter((i) => i.type === MediaType.SHOW);

    this.logger.log(
      `Found ${candidates.length} stale hero candidates (${movieItems.length} movies, ${showItems.length} shows)`,
    );

    const [movieWatchers, showWatchers] = await Promise.all([
      this.traktRatingsPort.getMovieWatchersByTmdbIds(movieItems.map((i) => i.tmdbId)),
      this.traktRatingsPort.getShowWatchersByTmdbIds(showItems.map((i) => i.tmdbId)),
    ]);

    const watchersMap = this.mergeWatchers(movieWatchers, showWatchers);

    const { fetched, skipped, notFound } = this.aggregateWatchersResults(watchersMap, candidates);

    this.logger.log(
      `Trakt watchers: requested=${candidates.length}, fetched=${fetched}, skipped=${skipped}, notFound=${notFound}`,
    );

    // Items with successful response (number) - update watchers and scores
    const itemsWithData = candidates.filter(
      (i) => typeof watchersMap.get(mediaKey(i.type, i.tmdbId)) === 'number',
    );
    // Items not found in Trakt (undefined) - just touch updated_at to unblock queue
    const itemsNotFound = candidates.filter(
      (i) => watchersMap.get(mediaKey(i.type, i.tmdbId)) === undefined,
    );
    // Items with transient errors (null) - skip, will retry next run

    const scoreDataList = await this.mediaRepository.findManyForScoring(
      itemsWithData.map((i) => i.id),
    );
    const scoreDataMap = new Map(scoreDataList.map((s) => [mediaKey(s.type, s.tmdbId), s]));

    const statsToUpsert: MediaStatsData[] = [];

    // Add items with watchers data
    for (const item of itemsWithData) {
      const key = mediaKey(item.type, item.tmdbId);
      const watchers = watchersMap.get(key)! as number;
      const scoreData = scoreDataMap.get(key);

      const scores = scoreData
        ? this.scoreCalculator.calculate(toScoreInput(scoreData, watchers))
        : null;

      statsToUpsert.push({
        mediaItemId: item.id,
        watchersCount: watchers,
        ratingoScore: scores?.ratingoScore,
        qualityScore: scores?.qualityScore,
        popularityScore: scores?.popularityScore,
        freshnessScore: scores?.freshnessScore,
      });
    }

    // Add items not found in Trakt - just touch updated_at (COALESCE keeps existing values)
    for (const item of itemsNotFound) {
      statsToUpsert.push({ mediaItemId: item.id });
    }

    if (statsToUpsert.length > 0) {
      await this.statsRepository.bulkUpsert(statsToUpsert);
    }

    const moviesUpdated = itemsWithData.filter((i) => i.type === MediaType.MOVIE).length;
    const showsUpdated = itemsWithData.filter((i) => i.type === MediaType.SHOW).length;

    this.logger.log(
      `Synced hero candidates stats: ${moviesUpdated} movies, ${showsUpdated} shows, ${itemsNotFound.length} not found (${skipped} transient errors)`,
    );

    return {
      movies: moviesUpdated,
      shows: showsUpdated,
      total: moviesUpdated + showsUpdated,
    };
  }
}
