import { Injectable } from '@nestjs/common';
import { BaseTraktHttp } from './base-trakt-http';
import {
  EpisodeData,
  SeasonData,
  TraktSearchMovieResult,
  TraktSearchShowResult,
  TraktRatingsResponse,
  TraktStatsResponse,
  TraktWatchingUser,
  TraktMediaType,
  TraktEndpoint,
  TRAKT_MEDIA_TYPE,
  TRAKT_ENDPOINT,
} from './interfaces/trakt.types';
import { TraktRatingsPort } from '../../../domain/ports/trakt-ratings.port';

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
   * @param {'movie' | 'show'} type - Media type
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null>} Ratings payload or null
   */
  private async getRatingsByTmdbId(
    type: TraktMediaType,
    tmdbId: number,
  ): Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null> {
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
        this.fetch<TraktWatchingUser[]>(`/${endpoint}/${traktId}/watching`)
          .then((w) => w.length)
          .catch(() => 0),
        this.fetch<TraktStatsResponse>(`/${endpoint}/${traktId}/stats`).catch(() => ({
          watchers: 0,
        })),
      ]);

      if (ratingsResult.status === 'rejected') {
        throw ratingsResult.reason;
      }

      const ratings = ratingsResult.value;
      const watchers = watchersResult.status === 'fulfilled' ? watchersResult.value : 0;
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : { watchers: 0 };

      return {
        rating: ratings.rating,
        votes: ratings.votes,
        watchers,
        totalWatchers: stats.watchers,
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
   * @returns {Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null>} Ratings payload or null
   */
  async getMovieRatingsByTmdbId(
    tmdbId: number,
  ): Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null> {
    return this.getRatingsByTmdbId(TRAKT_MEDIA_TYPE.MOVIE, tmdbId);
  }

  /**
   * Get show ratings and watchers by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null>} Ratings payload or null
   */
  async getShowRatingsByTmdbId(
    tmdbId: number,
  ): Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null> {
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
        seasons.slice(0, 10).map(async (s) => ({
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
   * Returns null for items that failed due to transient errors (429, 5xx, network).
   * Returns 0 for items not found in Trakt (404).
   *
   * @param {'movie' | 'show'} type - Media type
   * @param {number[]} tmdbIds - TMDB IDs
   * @param {number} concurrency - Max concurrent requests (default: 3)
   * @returns {Promise<Map<number, number | null>>} Map of tmdbId -> watchers (null = error, skip update)
   */
  private async getWatchersByTmdbIds(
    type: TraktMediaType,
    tmdbIds: number[],
    concurrency = 3,
  ): Promise<Map<number, number | null>> {
    const result = new Map<number, number | null>();
    if (tmdbIds.length === 0) return result;

    const fetchFn = type === 'movie' ? this.getMovieRatingsByTmdbId : this.getShowRatingsByTmdbId;

    for (let i = 0; i < tmdbIds.length; i += concurrency) {
      const batch = tmdbIds.slice(i, i + concurrency);
      const promises = batch.map(async (tmdbId) => {
        try {
          const data = await fetchFn.call(this, tmdbId);
          return { tmdbId, watchers: data?.watchers ?? 0 };
        } catch (error: any) {
          const status = error?.response?.status;
          if (status === 429 || status >= 500 || !status) {
            this.logger.warn(`Transient error for ${type} ${tmdbId}: ${error.message || error}`);
            return { tmdbId, watchers: null };
          }
          return { tmdbId, watchers: 0 };
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
    concurrency = 3,
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
    concurrency = 3,
  ): Promise<Map<number, number | null>> {
    return this.getWatchersByTmdbIds(TRAKT_MEDIA_TYPE.SHOW, tmdbIds, concurrency);
  }
}
