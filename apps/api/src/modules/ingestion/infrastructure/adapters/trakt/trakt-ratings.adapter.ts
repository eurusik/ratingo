import { HttpStatus, Injectable } from '@nestjs/common';

import { type TraktRatingsPort } from '../../../domain/ports/trakt-ratings.port';
import { TRAKT_BATCH_CONCURRENCY, MAX_SEASONS_FOR_ANALYSIS } from '../../../ingestion.constants';

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
   * @param {string | number} traktIdOrSlug - Trakt ID or slug
   * @returns {Promise<number>} Current watchers count
   */
  async getMovieWatchers(traktIdOrSlug: string | number): Promise<number> {
    try {
      const watchers = await this.fetch<TraktWatchingUser[]>(`/movies/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch {
      return 0;
    }
  }

  /**
   * Retrieves full stats for a movie (watchers, plays, collected, etc.)
   *
   * @param {string | number} traktIdOrSlug - Trakt ID or slug
   * @returns {Promise<TraktStatsResponse>} Movie stats payload
   */
  async getMovieStats(traktIdOrSlug: string | number): Promise<TraktStatsResponse> {
    try {
      return await this.fetch(`/movies/${traktIdOrSlug}/stats`);
    } catch {
      return { watchers: 0, plays: 0, votes: 0 };
    }
  }

  /**
   * Gets count of users currently watching a show.
   *
   * @param {string | number} traktIdOrSlug - Trakt ID or slug
   * @returns {Promise<number>} Current watchers count
   */
  async getShowWatchers(traktIdOrSlug: string | number): Promise<number> {
    try {
      const watchers = await this.fetch<TraktWatchingUser[]>(`/shows/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch {
      return 0;
    }
  }

  /**
   * Retrieves full stats for a show.
   *
   * @param {string | number} traktIdOrSlug - Trakt ID or slug
   * @returns {Promise<TraktStatsResponse>} Show stats payload
   */
  async getShowStats(traktIdOrSlug: string | number): Promise<TraktStatsResponse> {
    try {
      return await this.fetch(`/shows/${traktIdOrSlug}/stats`);
    } catch {
      return { watchers: 0, plays: 0, votes: 0 };
    }
  }

  /**
   * Generic method to get ratings by TMDB ID for both movies and shows.
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
      const results = await this.fetch<(TraktSearchMovieResult | TraktSearchShowResult)[]>(
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

      const [ratingsResult, watchersResult, statsResult] = await Promise.allSettled([
        this.fetch<TraktRatingsResponse>(`/${endpoint}/${traktId}/ratings`),
        this.fetch<TraktWatchingUser[]>(`/${endpoint}/${traktId}/watching`).then((w) => w.length),
        this.fetch<TraktStatsResponse>(`/${endpoint}/${traktId}/stats`),
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
   * Generic method to get watchers count for multiple items by TMDB IDs.
   * Uses concurrency limit to avoid rate limiting.
   *
   * Returns null for items that failed due to transient errors (429, 5xx, network, /watching failure).
   * Returns 0 only for items not found in Trakt (404) or items with genuinely 0 watchers.
   *
   * @param {'movie' | 'show'} type - Media type
   * @param {number[]} tmdbIds - TMDB IDs
   * @param {number} concurrency - Max concurrent requests (default: 3)
   * @returns {Promise<Map<number, number | null>>} Map of tmdbId -> watchers (null = error, skip update)
   */
  private async getWatchersByTmdbIds(
    type: TraktMediaType,
    tmdbIds: number[],
    concurrency = TRAKT_BATCH_CONCURRENCY,
  ): Promise<Map<number, number | null>> {
    const result = new Map<number, number | null>();
    if (tmdbIds.length === 0) return result;

    const fetchFn = type === 'movie' ? this.getMovieRatingsByTmdbId : this.getShowRatingsByTmdbId;

    for (let i = 0; i < tmdbIds.length; i += concurrency) {
      const batch = tmdbIds.slice(i, i + concurrency);
      const promises = batch.map(async (tmdbId) => {
        try {
          const data = await fetchFn.call(this, tmdbId);
          // CRITICAL: data === null means API call failed (rate limit, network error, etc.)
          // OR item not found in Trakt. In both cases, return null to skip update
          // and preserve existing data in the database.
          if (data === null) {
            return { tmdbId, watchers: null }; // Skip update, preserve existing data
          }
          return { tmdbId, watchers: data.watchers }; // Can be number or null
        } catch (error: unknown) {
          const err = error as { response?: { status?: number }; message?: string };
          const status = err?.response?.status;
          if (
            status === HttpStatus.TOO_MANY_REQUESTS ||
            (status && status >= HttpStatus.INTERNAL_SERVER_ERROR) ||
            !status
          ) {
            this.logger.warn(
              `Transient error for ${type} ${tmdbId}: ${err.message || String(error)}`,
            );
            return { tmdbId, watchers: null };
          }
          return { tmdbId, watchers: null }; // Also skip on other errors to be safe
        }
      });

      const batchResults = await Promise.all(promises);
      for (const { tmdbId, watchers } of batchResults) {
        result.set(tmdbId, watchers);
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
      const results = await this.fetch<(TraktSearchMovieResult | TraktSearchShowResult)[]>(
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

      const stats = await this.fetch<TraktStatsResponse>(`/${endpoint}/${traktId}/stats`);
      return { watchers: stats.watchers };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt stats for ${type} TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }
}
