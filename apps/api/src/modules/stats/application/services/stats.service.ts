import { Inject, Injectable, Logger } from '@nestjs/common';
import { TraktAdapter } from '@/modules/ingestion/infrastructure/adapters/trakt/trakt.adapter';
import { IStatsRepository, STATS_REPOSITORY } from '../../domain/repositories/stats.repository.interface';
import { IMediaRepository, MEDIA_REPOSITORY } from '@/modules/catalog/domain/repositories/media.repository.interface';
import { StatsNotFoundException } from '@/common/exceptions';

/**
 * Application service for managing media statistics.
 * Coordinates fetching real-time stats from Trakt and persisting to database.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly traktAdapter: TraktAdapter,

    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,

    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Syncs trending stats from Trakt API.
   * Fetches current watchers count and trending rank for movies and shows,
   * then updates the media_stats table for items that exist in our database.
   *
   * @param {number} limit - Number of trending items to fetch per type (default: 20)
   * @returns {Promise<{movies: number, shows: number}>} Count of updated items
   *
   * @example
   * const result = await statsService.syncTrendingStats(50);
   * // { movies: 45, shows: 38 }
   */
  async syncTrendingStats(limit = 20): Promise<{ movies: number; shows: number }> {
    this.logger.log(`Syncing trending stats (limit: ${limit})...`);

    // Fetch trending from Trakt
    const [trendingMovies, trendingShows] = await Promise.all([
      this.traktAdapter.getTrendingMoviesWithWatchers(limit),
      this.traktAdapter.getTrendingShowsWithWatchers(limit),
    ]);

    let moviesUpdated = 0;
    let showsUpdated = 0;

    // Update movie stats
    for (const movie of trendingMovies) {
      const mediaItem = await this.mediaRepository.findByTmdbId(movie.tmdbId);
      if (mediaItem) {
        await this.statsRepository.upsert({
          mediaItemId: mediaItem.id,
          watchersCount: movie.watchers,
          trendingRank: movie.rank,
        });
        moviesUpdated++;
      }
    }

    // Update show stats
    for (const show of trendingShows) {
      const mediaItem = await this.mediaRepository.findByTmdbId(show.tmdbId);
      if (mediaItem) {
        await this.statsRepository.upsert({
          mediaItemId: mediaItem.id,
          watchersCount: show.watchers,
          trendingRank: show.rank,
        });
        showsUpdated++;
      }
    }

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
