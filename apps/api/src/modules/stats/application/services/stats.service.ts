import { Inject, Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PAGE_SIZE, MS_PER_MINUTE } from '@/common/constants';
import { MediaType } from '@/common/enums/media-type.enum';

// Stats sync constants
const SAFETY_WINDOW_MINUTES = 5;
const SAFETY_WINDOW_MS = SAFETY_WINDOW_MINUTES * MS_PER_MINUTE;
const NOT_FOUND_EXAMPLES_LIMIT = 5;

import { StatsNotFoundException } from '../../../../common/exceptions';
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

/**
 * Application service for managing media statistics.
 * Coordinates fetching real-time stats from Trakt and persisting to database.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

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
  async syncTrendingStats(limit = DEFAULT_PAGE_SIZE): Promise<{ movies: number; shows: number }> {
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
        ? this.scoreCalculator.calculate({
            tmdbPopularity: scoreData.popularity,
            traktWatchers: item.watchers,
            imdbRating: scoreData.ratingImdb,
            traktRating: scoreData.ratingTrakt,
            metacriticRating: scoreData.ratingMetacritic,
            rottenTomatoesRating: scoreData.ratingRottenTomatoes,
            imdbVotes: scoreData.voteCountImdb,
            traktVotes: scoreData.voteCountTrakt,
            releaseDate: scoreData.releaseDate,
            lastAirDate: scoreData.lastAirDate,
          })
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
   * Gets stats for a media item by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID of the media item
   * @returns {Promise<import('../../domain/repositories/stats.repository.interface').MediaStatsData>} Stats data
   * @throws {StatsNotFoundException} If stats not found
   */
  async getStatsByTmdbId(tmdbId: number) {
    const stats = await this.statsRepository.findByTmdbId(tmdbId);
    if (!stats) {
      throw new StatsNotFoundException(tmdbId, 'tmdbId');
    }
    return stats;
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
   * @param {object} options - Sync options
   * @param {Date} options.since - Only items updated after this date
   * @param {number} options.limit - Max items to sync
   * @returns {Promise<{ movies: number; shows: number }>} Count of updated items
   */
  async syncTrendingStatsForUpdatedItems(options: {
    since?: Date;
    limit: number;
  }): Promise<{ movies: number; shows: number }> {
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

    // Merge watchers maps (null = transient error, skip update)
    const watchersMap = new Map<number, number | null>();
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

    // 3. Get score data for items we'll update (exclude errors)
    const itemsToUpdate = dbItems.filter((i) => watchersMap.get(i.tmdbId) !== null);
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
        ? this.scoreCalculator.calculate({
            tmdbPopularity: scoreData.popularity,
            traktWatchers: watchers,
            imdbRating: scoreData.ratingImdb,
            traktRating: scoreData.ratingTrakt,
            metacriticRating: scoreData.ratingMetacritic,
            rottenTomatoesRating: scoreData.ratingRottenTomatoes,
            imdbVotes: scoreData.voteCountImdb,
            traktVotes: scoreData.voteCountTrakt,
            releaseDate: scoreData.releaseDate,
            lastAirDate: scoreData.lastAirDate,
          })
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
   */
  private aggregateWatchersResults(
    watchersMap: Map<number, number | null>,
    dbItems: { tmdbId: number; type: string }[],
  ): {
    fetched: number;
    skipped: number;
    notFound: number;
    notFoundExamples: { tmdbId: number; type: string }[];
  } {
    let fetched = 0;
    let skipped = 0;
    let notFound = 0;
    const notFoundExamples: { tmdbId: number; type: string }[] = [];

    for (const [tmdbId, watchers] of watchersMap) {
      if (watchers === null) {
        skipped++;
        continue;
      }

      fetched++;
      if (watchers === 0) {
        notFound++;
        this.collectNotFoundExample(tmdbId, dbItems, notFoundExamples);
      }
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
   * Recalculates scores for all media items.
   * Uses pagination to process items in batches.
   *
   * @param options - Recalculation options
   * @param options.type - Filter by media type (movie/show)
   * @param options.batchSize - Number of items per batch
   * @returns Total count of recalculated items
   */
  async recalculateScores(options: {
    type?: MediaType;
    batchSize?: number;
  }): Promise<{ total: number }> {
    const batchSize = options.batchSize ?? 100;
    let offset = 0;
    let total = 0;

    this.logger.log(
      `Starting score recalculation (type: ${options.type ?? 'all'}, batchSize: ${batchSize})...`,
    );

    while (true) {
      const ids = await this.mediaRepository.findIdsForRecalculation({
        type: options.type,
        limit: batchSize,
        offset,
      });

      if (ids.length === 0) break;

      const scoreDataList = await this.mediaRepository.findManyForScoring(ids);

      const statsToUpsert: MediaStatsData[] = [];

      for (const scoreData of scoreDataList) {
        const scores = this.scoreCalculator.calculate({
          tmdbPopularity: scoreData.popularity,
          traktWatchers: scoreData.watchersCount ?? 0,
          imdbRating: scoreData.ratingImdb,
          traktRating: scoreData.ratingTrakt,
          metacriticRating: scoreData.ratingMetacritic,
          rottenTomatoesRating: scoreData.ratingRottenTomatoes,
          imdbVotes: scoreData.voteCountImdb,
          traktVotes: scoreData.voteCountTrakt,
          releaseDate: scoreData.releaseDate,
          lastAirDate: scoreData.lastAirDate,
        });

        statsToUpsert.push({
          mediaItemId: scoreData.id,
          ratingoScore: scores.ratingoScore,
          qualityScore: scores.qualityScore,
          popularityScore: scores.popularityScore,
          freshnessScore: scores.freshnessScore,
        });
      }

      if (statsToUpsert.length > 0) {
        await this.statsRepository.bulkUpsert(statsToUpsert);
      }

      total += statsToUpsert.length;
      offset += batchSize;

      this.logger.log(`Recalculated ${total} items...`);
    }

    this.logger.log(`Score recalculation complete: ${total} items updated`);
    return { total };
  }

  /**
   * Backfills total_watchers for items that have corrupted data.
   * Finds items where total_watchers = 0 but have Trakt votes (indicating API failure during sync).
   *
   * @param options - Backfill options
   * @param options.type - Filter by media type (movie/show)
   * @param options.limit - Max items to process
   * @param options.minVotes - Minimum Trakt votes to consider (default: 100)
   * @returns Count of backfilled items
   */
  async backfillTotalWatchers(options: {
    type?: MediaType;
    limit?: number;
    minVotes?: number;
  }): Promise<{ total: number; success: number; failed: number }> {
    const limit = options.limit ?? 100;
    const minVotes = options.minVotes ?? 100;

    this.logger.log(
      `Starting total_watchers backfill (type: ${options.type ?? 'all'}, limit: ${limit}, minVotes: ${minVotes})...`,
    );

    // Find items with corrupted data: total_watchers = 0 but have Trakt votes
    const corruptedItems = await this.mediaRepository.findItemsWithMissingWatchers({
      type: options.type,
      limit,
      minVotes,
    });

    if (corruptedItems.length === 0) {
      this.logger.log('No corrupted items found');
      return { total: 0, success: 0, failed: 0 };
    }

    this.logger.log(`Found ${corruptedItems.length} items with missing total_watchers`);

    let success = 0;
    let failed = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    const BASE_DELAY_MS = 200;

    // Process items with exponential backoff on rate limiting
    for (const item of corruptedItems) {
      const stats = await this.fetchStatsWithRetry(item.type, item.tmdbId);

      if (stats && stats.watchers > 0) {
        await this.statsRepository.updateTotalWatchers(item.id, stats.watchers);
        success++;
        consecutiveFailures = 0;
        this.logger.debug(
          `Updated ${item.type} ${item.tmdbId}: total_watchers = ${stats.watchers}`,
        );
      } else if (stats === null) {
        // Transient error - count as failure and apply backoff
        failed++;
        consecutiveFailures++;

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.logger.warn(
            `Stopping backfill after ${MAX_CONSECUTIVE_FAILURES} consecutive failures (possible rate limiting)`,
          );
          break;
        }

        // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms
        const backoffDelay = BASE_DELAY_MS * Math.pow(2, consecutiveFailures);
        this.logger.debug(`Backing off for ${backoffDelay}ms after failure`);
        await this.sleep(backoffDelay);
        continue;
      } else {
        // No data found (not an error, just no watchers)
        this.logger.debug(`No watchers data for ${item.type} ${item.tmdbId}`);
        failed++;
        consecutiveFailures = 0;
      }

      // Base delay between requests to avoid rate limiting
      await this.sleep(BASE_DELAY_MS);
    }

    this.logger.log(`Backfill complete: ${success} success, ${failed} failed`);
    return { total: corruptedItems.length, success, failed };
  }

  /**
   * Fetches stats with retry logic and exponential backoff.
   *
   * @param type - Media type
   * @param tmdbId - TMDB ID
   * @param maxRetries - Maximum retry attempts
   * @returns Stats or null on transient failure, undefined if not found
   */
  private async fetchStatsWithRetry(
    type: MediaType,
    tmdbId: number,
    maxRetries = 3,
  ): Promise<{ watchers: number } | null | undefined> {
    const BASE_RETRY_DELAY_MS = 500;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stats =
          type === MediaType.MOVIE
            ? await this.traktRatingsPort.getMovieStatsByTmdbId(tmdbId)
            : await this.traktRatingsPort.getShowStatsByTmdbId(tmdbId);

        return stats; // Success or not found
      } catch (error: unknown) {
        const err = error as { response?: { status?: number }; message?: string };
        const status = err?.response?.status;
        const isRateLimited = status === 429;
        const isServerError = status && status >= 500;

        if (isRateLimited || isServerError) {
          if (attempt < maxRetries) {
            const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
            this.logger.debug(
              `Retry ${attempt + 1}/${maxRetries} for ${type} ${tmdbId} after ${delay}ms (status: ${status})`,
            );
            await this.sleep(delay);
            continue;
          }
        }

        this.logger.warn(`Failed to fetch stats for ${type} ${tmdbId}: ${err.message || error}`);
        return null; // Transient failure
      }
    }

    return null;
  }

  /**
   * Promise-based sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
