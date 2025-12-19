import { Inject, Injectable, Logger } from '@nestjs/common';
import { TraktListsAdapter } from '../../../ingestion/infrastructure/adapters/trakt/trakt-lists.adapter';
import { TraktRatingsAdapter } from '../../../ingestion/infrastructure/adapters/trakt/trakt-ratings.adapter';
import {
  IStatsRepository,
  STATS_REPOSITORY,
} from '../../domain/repositories/stats.repository.interface';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { StatsNotFoundException } from '../../../../common/exceptions';
import { ScoreCalculatorService } from '../../../shared/score-calculator';

/**
 * Application service for managing media statistics.
 * Coordinates fetching real-time stats from Trakt and persisting to database.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly traktListsAdapter: TraktListsAdapter,
    private readonly traktRatingsAdapter: TraktRatingsAdapter,
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
  async syncTrendingStats(limit = 20): Promise<{ movies: number; shows: number }> {
    this.logger.log(`Syncing trending stats (limit: ${limit})...`);

    // Fetch trending from Trakt (parallel)
    const [trendingMovies, trendingShows] = await Promise.all([
      this.traktListsAdapter.getTrendingMoviesWithWatchers(limit),
      this.traktListsAdapter.getTrendingShowsWithWatchers(limit),
    ]);

    // Combine all trending items
    const allTrending = [
      ...trendingMovies.map((m) => ({ ...m, type: 'movie' as const })),
      ...trendingShows.map((s) => ({ ...s, type: 'show' as const })),
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
    const statsToUpsert: import('../../domain/repositories/stats.repository.interface').MediaStatsData[] =
      [];

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

    const moviesUpdated = existingTrending.filter((t) => t.type === 'movie').length;
    const showsUpdated = existingTrending.filter((t) => t.type === 'show').length;

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
    const safetyWindowMs = 5 * 60 * 1000;
    const adjustedSince = options.since
      ? new Date(options.since.getTime() - safetyWindowMs)
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
    const movieItems = dbItems.filter((i) => i.type === 'movie');
    const showItems = dbItems.filter((i) => i.type === 'show');

    this.logger.log(
      `Found ${dbItems.length} trending updated items in DB (${movieItems.length} movies, ${showItems.length} shows)`,
    );

    // 2. Fetch watchers from Trakt by TMDB IDs (batch with concurrency limit)
    const [movieWatchers, showWatchers] = await Promise.all([
      this.traktRatingsAdapter.getMovieWatchersByTmdbIds(movieItems.map((i) => i.tmdbId)),
      this.traktRatingsAdapter.getShowWatchersByTmdbIds(showItems.map((i) => i.tmdbId)),
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
    const requested = dbItems.length;
    let fetched = 0;
    let skipped = 0;
    let notFound = 0;

    for (const [, watchers] of watchersMap) {
      if (watchers === null) {
        skipped++; // Transient error
      } else if (watchers === 0) {
        notFound++; // Not found in Trakt (or genuinely 0 watchers)
        fetched++;
      } else {
        fetched++;
      }
    }

    this.logger.log(
      `Trakt watchers: requested=${requested}, fetched=${fetched}, skipped=${skipped}, notFound=${notFound}`,
    );

    // 3. Get score data for items we'll update (exclude errors)
    const itemsToUpdate = dbItems.filter((i) => watchersMap.get(i.tmdbId) !== null);
    const scoreDataList = await this.mediaRepository.findManyForScoring(
      itemsToUpdate.map((i) => i.id),
    );
    const scoreDataMap = new Map(scoreDataList.map((s) => [s.tmdbId, s]));

    // 4. Build stats to upsert (skip items with null watchers to preserve old data)
    const statsToUpsert: import('../../domain/repositories/stats.repository.interface').MediaStatsData[] =
      [];

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

    const moviesUpdated = itemsToUpdate.filter((i) => i.type === 'movie').length;
    const showsUpdated = itemsToUpdate.filter((i) => i.type === 'show').length;

    this.logger.log(
      `Synced stats: ${moviesUpdated} movies, ${showsUpdated} shows (${skipped} skipped due to errors)`,
    );
    return { movies: moviesUpdated, shows: showsUpdated };
  }
}
