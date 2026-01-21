import { Injectable } from '@nestjs/common';

import { type TraktRatingsPort } from '../../../domain/ports/trakt-ratings.port';
import {
  TRAKT_BATCH_CONCURRENCY,
  TRAKT_BULK_CHUNK_SIZE,
  TRAKT_BULK_CHUNK_DELAY_MS,
  MAX_SEASONS_FOR_ANALYSIS,
} from '../../../ingestion.constants';

import { BaseTraktHttp } from './base-trakt-http';
import {
  type EpisodeData,
  type SeasonData,
  type TraktSearchMovieResult,
  type TraktSearchShowResult,
  type TraktRatingsResponse,
  type TraktStatsResponse,
  type TraktWatchingUser,
  type TraktMediaType,
  type TraktEndpoint,
  TRAKT_MEDIA_TYPE,
  TRAKT_ENDPOINT,
} from './interfaces/trakt.types';

/**
 * Trakt adapter for ratings, watchers, stats, and episode/season metadata.
 * Implements TraktRatingsPort for DDD compliance.
 */
@Injectable()
export class TraktRatingsAdapter extends BaseTraktHttp implements TraktRatingsPort {
  /**
   * Retrieves detailed ratings for a movie.
   *
   * @param {string | number} idOrSlug - Trakt ID or slug
   * @returns {Promise<TraktRatingsResponse>} Movie ratings payload
   */
  async getMovieRatings(idOrSlug: string | number): Promise<TraktRatingsResponse> {
    return this.fetch(`/movies/${idOrSlug}/ratings`);
  }

  /**
   * Retrieves detailed ratings for a show.
   *
   * @param {string | number} idOrSlug - Trakt ID or slug
   * @returns {Promise<TraktRatingsResponse>} Show ratings payload
   */
  async getShowRatings(idOrSlug: string | number): Promise<TraktRatingsResponse> {
    return this.fetch(`/shows/${idOrSlug}/ratings`);
  }

  /**
   * Gets count of users currently watching a movie.
   *
   * @param traktIdOrSlug - Trakt ID or slug
   * @returns Current watchers count, or null on error (skip update)
   */
  async getMovieWatchers(traktIdOrSlug: string | number): Promise<number | null> {
    try {
      const watchers = await this.fetch<TraktWatchingUser[]>(`/movies/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch (error) {
      this.logger.warn(`Failed to get movie watchers for ${traktIdOrSlug}: ${error}`);
      return null;
    }
  }

  /**
   * Retrieves full stats for a movie (watchers, plays, collected, etc.)
   *
   * @param traktIdOrSlug - Trakt ID or slug
   * @returns Movie stats payload, or null on error (skip update)
   */
  async getMovieStats(traktIdOrSlug: string | number): Promise<TraktStatsResponse | null> {
    try {
      return await this.fetch(`/movies/${traktIdOrSlug}/stats`);
    } catch (error) {
      this.logger.warn(`Failed to get movie stats for ${traktIdOrSlug}: ${error}`);
      return null;
    }
  }

  /**
   * Gets count of users currently watching a show.
   *
   * @param traktIdOrSlug - Trakt ID or slug
   * @returns Current watchers count, or null on error (skip update)
   */
  async getShowWatchers(traktIdOrSlug: string | number): Promise<number | null> {
    try {
      const watchers = await this.fetch<TraktWatchingUser[]>(`/shows/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch (error) {
      this.logger.warn(`Failed to get show watchers for ${traktIdOrSlug}: ${error}`);
      return null;
    }
  }

  /**
   * Retrieves full stats for a show.
   *
   * @param traktIdOrSlug - Trakt ID or slug
   * @returns Show stats payload, or null on error (skip update)
   */
  async getShowStats(traktIdOrSlug: string | number): Promise<TraktStatsResponse | null> {
    try {
      return await this.fetch(`/shows/${traktIdOrSlug}/stats`);
    } catch (error) {
      this.logger.warn(`Failed to get show stats for ${traktIdOrSlug}: ${error}`);
      return null;
    }
  }

  /**
   * Generic method to get ratings by TMDB ID for both movies and shows.
   * Uses bulk time budget since this is called during backfill/sync operations.
   *
   * IMPORTANT: Both watchers and totalWatchers can be null if their respective endpoints fail.
   * This prevents silent data corruption where 0 is written on API failures.
   *
   * @param {'movie' | 'show'} type - Media type
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ rating: number; votes: number; watchers: number | null; totalWatchers: number | null } | null>} Ratings payload or null
   */
  private async getRatingsByTmdbId(
    type: TraktMediaType,
    tmdbId: number,
  ): Promise<{
    rating: number;
    votes: number;
    watchers: number | null;
    totalWatchers: number | null;
  } | null> {
    try {
      // Use bulk mode for backfill/sync operations - 10 min time budget
      const results = await this.fetchBulk<(TraktSearchMovieResult | TraktSearchShowResult)[]>(
        `/search/tmdb/${tmdbId}?type=${type}`,
      );
      const firstResult = results[0];
      let traktId: number | undefined;

      if (firstResult) {
        if ('movie' in firstResult) {
          traktId = firstResult.movie?.ids?.trakt;
        } else if ('show' in firstResult) {
          traktId = firstResult.show?.ids?.trakt;
        }
      }

      if (!results.length || !traktId) {
        return null;
      }

      const endpoint: TraktEndpoint =
        type === TRAKT_MEDIA_TYPE.MOVIE ? TRAKT_ENDPOINT.MOVIES : TRAKT_ENDPOINT.SHOWS;

      // Use bulk mode for all calls since this is called during mass operations
      const [ratingsResult, watchersResult, statsResult] = await Promise.allSettled([
        this.fetchBulk<TraktRatingsResponse>(`/${endpoint}/${traktId}/ratings`),
        this.fetchBulk<TraktWatchingUser[]>(`/${endpoint}/${traktId}/watching`).then(
          (w) => w.length,
        ),
        this.fetchBulk<TraktStatsResponse>(`/${endpoint}/${traktId}/stats`),
      ]);

      if (ratingsResult.status === 'rejected') {
        throw ratingsResult.reason;
      }

      const ratings = ratingsResult.value;

      // CRITICAL: Don't substitute 0 on /watching failure - return null to preserve existing data
      let watchers: number | null = null;
      if (watchersResult.status === 'fulfilled') {
        watchers = watchersResult.value;
      } else {
        this.logger.warn(
          `Trakt /watching failed for ${type} TMDB:${tmdbId} (traktId:${traktId}): ${watchersResult.reason}`,
        );
      }

      // CRITICAL: Don't substitute 0 on /stats failure - return null to preserve existing data
      let totalWatchers: number | null = null;
      if (statsResult.status === 'fulfilled') {
        totalWatchers = statsResult.value.watchers;
      } else {
        this.logger.warn(
          `Trakt /stats failed for ${type} TMDB:${tmdbId} (traktId:${traktId}): ${statsResult.reason}`,
        );
      }

      return {
        rating: ratings.rating,
        votes: ratings.votes,
        watchers,
        totalWatchers,
      };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt data for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }

  /**
   * Get movie ratings and watchers by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ rating: number; votes: number; watchers: number | null; totalWatchers: number | null } | null>} Ratings payload or null
   */
  async getMovieRatingsByTmdbId(tmdbId: number): Promise<{
    rating: number;
    votes: number;
    watchers: number | null;
    totalWatchers: number | null;
  } | null> {
    return this.getRatingsByTmdbId(TRAKT_MEDIA_TYPE.MOVIE, tmdbId);
  }

  /**
   * Get show ratings and watchers by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ rating: number; votes: number; watchers: number | null; totalWatchers: number | null } | null>} Ratings payload or null
   */
  async getShowRatingsByTmdbId(tmdbId: number): Promise<{
    rating: number;
    votes: number;
    watchers: number | null;
    totalWatchers: number | null;
  } | null> {
    return this.getRatingsByTmdbId(TRAKT_MEDIA_TYPE.SHOW, tmdbId);
  }

  /**
   * Gets Trakt ID for a show by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<number | null>} Trakt ID or null
   */
  async getTraktIdByTmdbId(tmdbId: number): Promise<number | null> {
    try {
      const results = await this.fetch<TraktSearchShowResult[]>(`/search/tmdb/${tmdbId}?type=show`);
      return results[0]?.show?.ids?.trakt || null;
    } catch {
      return null;
    }
  }

  /**
   * Gets all seasons for a show.
   *
   * @param {number} traktId - Trakt ID
   * @returns {Promise<Array<{ number: number; episodeCount: number }>>} Seasons list
   */
  async getShowSeasons(traktId: number): Promise<Array<{ number: number; episodeCount: number }>> {
    try {
      const seasons = await this.fetch<SeasonData[]>(`/shows/${traktId}/seasons`);
      return seasons
        .filter((s) => s.number > 0)
        .map((s) => ({
          number: s.number,
          episodeCount: s.episode_count || 0,
        }));
    } catch (error) {
      this.logger.warn(`Failed to get seasons for ${traktId}: ${error}`);
      return [];
    }
  }

  /**
   * Gets all episodes for a season with ratings.
   *
   * @param {number} traktId - Trakt ID
   * @param {number} seasonNumber - Season number
   * @returns {Promise<Array<{ number: number; title: string; rating: number; votes: number }>>} Episode ratings list
   */
  async getSeasonEpisodes(
    traktId: number,
    seasonNumber: number,
  ): Promise<Array<{ number: number; title: string; rating: number; votes: number }>> {
    try {
      const episodes = await this.fetch<EpisodeData[]>(
        `/shows/${traktId}/seasons/${seasonNumber}?extended=full`,
      );
      return episodes.map((ep) => ({
        number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
        rating: ep.rating || 0,
        votes: ep.votes || 0,
      }));
    } catch (error) {
      this.logger.warn(`Failed to get S${seasonNumber} episodes: ${error}`);
      return [];
    }
  }

  /**
   * Gets all episodes for a show (all seasons) for drop-off analysis.
   * Returns structured data ready for analysis.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ traktId: number; seasons: Array<{ number: number; episodes: Array<{ number: number; title: string; rating: number; votes: number }> }> } | null>} Analysis payload or null
   */
  async getShowEpisodesForAnalysis(tmdbId: number): Promise<{
    traktId: number;
    seasons: Array<{
      number: number;
      episodes: Array<{ number: number; title: string; rating: number; votes: number }>;
    }>;
  } | null> {
    try {
      const traktId = await this.getTraktIdByTmdbId(tmdbId);
      if (!traktId) return null;

      const seasons = await this.getShowSeasons(traktId);
      if (!seasons.length) return null;

      const seasonData = await Promise.all(
        seasons.slice(0, MAX_SEASONS_FOR_ANALYSIS).map(async (s) => ({
          number: s.number,
          episodes: await this.getSeasonEpisodes(traktId, s.number),
        })),
      );

      return {
        traktId,
        seasons: seasonData.filter((s) => s.episodes.length > 0),
      };
    } catch (error) {
      this.logger.warn(`Failed to get episodes for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }

  /**
   * Lightweight method to get live watchers count for a single item.
   * Only makes 2 API calls: search + watching (instead of 4 in getRatingsByTmdbId).
   * Uses bulk time budget for rate limit resilience.
   *
   * @param type - Media type
   * @param tmdbId - TMDB ID
   * @returns watchers count, or null on transient error (skip update)
   */
  private async getLiveWatchersByTmdbId(
    type: TraktMediaType,
    tmdbId: number,
  ): Promise<number | null> {
    try {
      // 1. Search for Trakt ID (1 API call)
      const results = await this.fetchBulk<(TraktSearchMovieResult | TraktSearchShowResult)[]>(
        `/search/tmdb/${tmdbId}?type=${type}`,
      );

      const firstResult = results[0];
      let traktId: number | undefined;

      if (firstResult) {
        if ('movie' in firstResult) {
          traktId = firstResult.movie?.ids?.trakt;
        } else if ('show' in firstResult) {
          traktId = firstResult.show?.ids?.trakt;
        }
      }

      if (!results.length || !traktId) {
        // Not found in Trakt - this is expected for some items
        return null;
      }

      // 2. Get live watchers (1 API call)
      const endpoint: TraktEndpoint =
        type === TRAKT_MEDIA_TYPE.MOVIE ? TRAKT_ENDPOINT.MOVIES : TRAKT_ENDPOINT.SHOWS;

      const watchers = await this.fetchBulk<TraktWatchingUser[]>(
        `/${endpoint}/${traktId}/watching`,
      );

      return watchers.length;
    } catch (error) {
      this.logger.warn(`Failed to get live watchers for ${type} TMDB ${tmdbId}: ${error}`);
      return null; // Transient error - skip update
    }
  }

  /**
   * Sleep utility for chunking delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets live watchers count for multiple items by TMDB IDs.
   * Uses chunking with delays to avoid rate limiting.
   * Only makes 2 API calls per item (search + watching).
   *
   * Returns null for items that failed (transient error) - skip DB update.
   * Returns number (including 0) for successful fetches.
   *
   * @param type - Media type
   * @param tmdbIds - TMDB IDs
   * @param concurrency - Max concurrent requests within a chunk
   * @returns Map of tmdbId -> watchers (null = error, skip update)
   */
  private async getWatchersByTmdbIds(
    type: TraktMediaType,
    tmdbIds: number[],
    concurrency = TRAKT_BATCH_CONCURRENCY,
  ): Promise<Map<number, number | null>> {
    const result = new Map<number, number | null>();
    if (tmdbIds.length === 0) return result;

    // Split into chunks for rate limit safety
    const chunks: number[][] = [];
    for (let i = 0; i < tmdbIds.length; i += TRAKT_BULK_CHUNK_SIZE) {
      chunks.push(tmdbIds.slice(i, i + TRAKT_BULK_CHUNK_SIZE));
    }

    this.logger.log(
      `Processing ${tmdbIds.length} ${type}s in ${chunks.length} chunks (chunk size: ${TRAKT_BULK_CHUNK_SIZE})`,
    );

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];

      // Process items within chunk with concurrency limit
      for (let i = 0; i < chunk.length; i += concurrency) {
        const batch = chunk.slice(i, i + concurrency);
        const promises = batch.map(async (tmdbId) => {
          const watchers = await this.getLiveWatchersByTmdbId(type, tmdbId);
          return { tmdbId, watchers };
        });

        const batchResults = await Promise.all(promises);
        for (const { tmdbId, watchers } of batchResults) {
          result.set(tmdbId, watchers);
        }
      }

      // Delay between chunks (except after last chunk)
      if (chunkIdx < chunks.length - 1) {
        this.logger.debug(
          `Chunk ${chunkIdx + 1}/${chunks.length} complete, waiting ${TRAKT_BULK_CHUNK_DELAY_MS}ms`,
        );
        await this.sleep(TRAKT_BULK_CHUNK_DELAY_MS);
      }
    }

    return result;
  }

  /**
   * Gets watchers count for multiple movies by TMDB IDs.
   *
   * @param {number[]} tmdbIds - TMDB IDs
   * @param {number} concurrency - Max concurrent requests (default: 3)
   * @returns {Promise<Map<number, number | null>>} Map of tmdbId -> watchers (null = error, skip update)
   */
  async getMovieWatchersByTmdbIds(
    tmdbIds: number[],
    concurrency = TRAKT_BATCH_CONCURRENCY,
  ): Promise<Map<number, number | null>> {
    return this.getWatchersByTmdbIds(TRAKT_MEDIA_TYPE.MOVIE, tmdbIds, concurrency);
  }

  /**
   * Gets watchers count for multiple shows by TMDB IDs.
   *
   * @param {number[]} tmdbIds - TMDB IDs
   * @param {number} concurrency - Max concurrent requests (default: 3)
   * @returns {Promise<Map<number, number | null>>} Map of tmdbId -> watchers (null = error, skip update)
   */
  async getShowWatchersByTmdbIds(
    tmdbIds: number[],
    concurrency = TRAKT_BATCH_CONCURRENCY,
  ): Promise<Map<number, number | null>> {
    return this.getWatchersByTmdbIds(TRAKT_MEDIA_TYPE.SHOW, tmdbIds, concurrency);
  }

  /**
   * Gets stats (total watchers) for a movie by TMDB ID.
   * Used for backfilling corrupted data.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ watchers: number } | null>} Stats or null if not found
   */
  async getMovieStatsByTmdbId(tmdbId: number): Promise<{ watchers: number } | null> {
    return this.getStatsByTmdbId(TRAKT_MEDIA_TYPE.MOVIE, tmdbId);
  }

  /**
   * Gets stats (total watchers) for a show by TMDB ID.
   * Used for backfilling corrupted data.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ watchers: number } | null>} Stats or null if not found
   */
  async getShowStatsByTmdbId(tmdbId: number): Promise<{ watchers: number } | null> {
    return this.getStatsByTmdbId(TRAKT_MEDIA_TYPE.SHOW, tmdbId);
  }

  /**
   * Generic method to get stats by TMDB ID.
   * Uses bulk time budget for backfill operations.
   *
   * @param {'movie' | 'show'} type - Media type
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ watchers: number } | null>} Stats or null
   */
  private async getStatsByTmdbId(
    type: TraktMediaType,
    tmdbId: number,
  ): Promise<{ watchers: number } | null> {
    try {
      // Use bulk mode for backfill operations - 10 min time budget
      const results = await this.fetchBulk<(TraktSearchMovieResult | TraktSearchShowResult)[]>(
        `/search/tmdb/${tmdbId}?type=${type}`,
      );
      const firstResult = results[0];
      let traktId: number | undefined;

      if (firstResult) {
        if ('movie' in firstResult) {
          traktId = firstResult.movie?.ids?.trakt;
        } else if ('show' in firstResult) {
          traktId = firstResult.show?.ids?.trakt;
        }
      }

      if (!results.length || !traktId) {
        return null;
      }

      const endpoint: TraktEndpoint =
        type === TRAKT_MEDIA_TYPE.MOVIE ? TRAKT_ENDPOINT.MOVIES : TRAKT_ENDPOINT.SHOWS;

      const stats = await this.fetchBulk<TraktStatsResponse>(`/${endpoint}/${traktId}/stats`);
      return { watchers: stats.watchers };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt stats for ${type} TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }
}
