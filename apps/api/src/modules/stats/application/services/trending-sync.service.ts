import { Inject, Injectable, Logger } from '@nestjs/common';

import { MAX_PAGE_SIZE, MS_PER_MINUTE } from '@/common/constants';
import { MediaType } from '@/common/enums/media-type.enum';

import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import {
  type TraktListsPort,
  TRAKT_LISTS_PORT,
  type TraktRatingsPort,
  TRAKT_RATINGS_PORT,
} from '../../../ingestion/public';
import { ScoreCalculatorService } from '../../../shared/score-calculator';
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
    const mediaMap = new Map(mediaItems.map((m) => [m.tmdbId, m.id]));

    // Filter to only items we have in DB
    const existingTrending = allTrending.filter((t) => mediaMap.has(t.tmdbId));

    if (existingTrending.length === 0) {
      this.logger.log('No matching media items in database');
      return { movies: 0, shows: 0 };
    }

    // Batch: Get score data for all existing items (1 query)
    const mediaIds = existingTrending.map((t) => mediaMap.get(t.tmdbId)!);
    const scoreDataList = await this.mediaRepository.findManyForScoring(mediaIds);
    const scoreDataMap = new Map(scoreDataList.map((s) => [s.tmdbId, s]));

    // Calculate scores and prepare batch upsert
    const statsToUpsert: MediaStatsData[] = [];

    for (const item of existingTrending) {
      const mediaId = mediaMap.get(item.tmdbId)!;
      const scoreData = scoreDataMap.get(item.tmdbId);

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

    // Merge watchers maps
    // number (including 0) = success, undefined = not found, null = transient error
    const watchersMap = new Map<number, number | null | undefined>();
    for (const [tmdbId, watchers] of movieWatchers) {
      watchersMap.set(tmdbId, watchers);
    }
    for (const [tmdbId, watchers] of showWatchers) {
      watchersMap.set(tmdbId, watchers);
    }

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
    const itemsToUpdate = dbItems.filter((i) => typeof watchersMap.get(i.tmdbId) === 'number');
    const scoreDataList = await this.mediaRepository.findManyForScoring(
      itemsToUpdate.map((i) => i.id),
    );
    const scoreDataMap = new Map(scoreDataList.map((s) => [s.tmdbId, s]));

    // 4. Build stats to upsert (skip items with null watchers to preserve old data)
    const statsToUpsert: MediaStatsData[] = [];

    for (const item of itemsToUpdate) {
      const watchers = watchersMap.get(item.tmdbId)!; // Not null, we filtered above
      const scoreData = scoreDataMap.get(item.tmdbId);

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
   * Aggregates watchers results for logging purposes.
   *
   * Semantics:
   * - number (including 0) = fetched successfully
   * - undefined = not found in Trakt (item doesn't exist there)
   * - null = transient error (429/5xx), skipped DB update
   */
  private aggregateWatchersResults(
    watchersMap: Map<number, number | null | undefined>,
    dbItems: { tmdbId: number; type: string }[],
  ): WatchersAggregationResult {
    let fetched = 0;
    let skipped = 0;
    let notFound = 0;
    const notFoundExamples: { tmdbId: number; type: string }[] = [];

    for (const [tmdbId, watchers] of watchersMap) {
      if (watchers === null) {
        // Transient error (429/5xx) - skip DB update
        skipped++;
        continue;
      }

      if (watchers === undefined) {
        // Not found in Trakt
        notFound++;
        this.collectNotFoundExample(tmdbId, dbItems, notFoundExamples);
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
    tmdbId: number,
    dbItems: { tmdbId: number; type: string }[],
    notFoundExamples: { tmdbId: number; type: string }[],
  ): void {
    if (notFoundExamples.length >= NOT_FOUND_EXAMPLES_LIMIT) return;

    const item = dbItems.find((i) => i.tmdbId === tmdbId);
    if (item) {
      notFoundExamples.push({ tmdbId, type: item.type });
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
   * @param {number} options.offset - Offset for pagination (default: 0)
   * @returns {Promise<{ movies: number; shows: number; total: number; hasMore: boolean }>} Sync result
   */
  async syncEligibleTrendingStats(options: {
    batchSize?: number;
    offset?: number;
  }): Promise<{ movies: number; shows: number; total: number; hasMore: boolean }> {
    const batchSize = options.batchSize ?? DEFAULT_ELIGIBLE_BATCH_SIZE;
    const offset = options.offset ?? 0;

    this.logger.log(
      `Syncing eligible trending stats (batchSize: ${batchSize}, offset: ${offset})...`,
    );

    // 1. Get ELIGIBLE items with pagination (+1 to detect hasMore)
    const eligibleItems = await this.mediaRepository.findEligibleForTrending({
      limit: batchSize + 1,
      offset,
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

    // Merge watchers maps
    // number (including 0) = success, undefined = not found, null = transient error
    const watchersMap = new Map<number, number | null | undefined>();
    for (const [tmdbId, watchers] of movieWatchers) {
      watchersMap.set(tmdbId, watchers);
    }
    for (const [tmdbId, watchers] of showWatchers) {
      watchersMap.set(tmdbId, watchers);
    }

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
    const itemsToUpdate = items.filter((i) => typeof watchersMap.get(i.tmdbId) === 'number');
    const scoreDataList = await this.mediaRepository.findManyForScoring(
      itemsToUpdate.map((i) => i.id),
    );
    const scoreDataMap = new Map(scoreDataList.map((s) => [s.tmdbId, s]));

    // 4. Build stats to upsert (skip items with null watchers to preserve old data)
    const statsToUpsert: MediaStatsData[] = [];

    for (const item of itemsToUpdate) {
      const watchers = watchersMap.get(item.tmdbId)!; // Not null, we filtered above
      const scoreData = scoreDataMap.get(item.tmdbId);

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
    };
  }
}
