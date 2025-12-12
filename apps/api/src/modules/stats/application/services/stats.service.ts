import { Inject, Injectable, Logger } from '@nestjs/common';
import { TraktListsAdapter } from '../../../ingestion/infrastructure/adapters/trakt/trakt-lists.adapter';
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
   * @param {number} limit - Number of trending items to fetch per type (default: 20)
   * @returns {Promise<{movies: number, shows: number}>} Count of updated items
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
   * @returns {Promise<MediaStatsData>} Stats data
   * @throws {StatsNotFoundException} If stats not found
   */
  async getStatsByTmdbId(tmdbId: number) {
    const stats = await this.statsRepository.findByTmdbId(tmdbId);
    if (!stats) {
      throw new StatsNotFoundException(tmdbId, 'tmdbId');
    }
    return stats;
  }
}
