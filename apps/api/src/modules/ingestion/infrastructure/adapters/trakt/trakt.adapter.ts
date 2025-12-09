import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import traktConfig from '../../../../../config/trakt.config';
import { TraktApiException } from '../../../../../common/exceptions/external-api.exception';
import { EpisodeData, SeasonData } from './interfaces/trakt.types';

/**
 * Adapter for communicating with the Trakt.tv API.
 * Handles fetching trending content and user-generated ratings.
 * 
 * Implements rate limiting handling (HTTP 429) to ensure stability.
 */
@Injectable()
export class TraktAdapter {
  private readonly logger = new Logger(TraktAdapter.name);

  constructor(
    @Inject(traktConfig.KEY)
    private readonly config: ConfigType<typeof traktConfig>,
  ) {
    if (!this.config.clientId) {
      throw new TraktApiException('Client ID is not configured');
    }
  }

  /**
   * Generic fetch wrapper with automatic rate limit handling.
   * 
   * @param {string} endpoint - API endpoint starting with slash (e.g., '/shows/trending')
   * @param {RequestInit} options - Standard fetch options
   * @returns {Promise<T>} Parsed JSON response
   * @throws {Error} If response is not OK and not retriable
   */
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    
    // Trakt headers requirements: 
    // - Content-Type: application/json
    // - trakt-api-version: 2
    // - trakt-api-key: client_id
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.config.clientId!,
      'User-Agent': this.config.userAgent,
      ...options.headers,
    };

    const makeReq = async () =>
      fetch(url, {
        ...options,
        headers,
      });

    let response = await makeReq();

    if (response.status === 429) {
      const ra = response.headers.get('Retry-After');
      const ms = Math.max(0, Math.round((parseFloat(String(ra || '10')) || 10) * 1000));
      this.logger.warn(`Rate limited. Waiting ${ms}ms...`);
      await new Promise((r) => setTimeout(r, ms));
      response = await makeReq();
    }

    if (!response.ok) {
      throw new TraktApiException(`${response.status} ${response.statusText}`, response.status);
    }

    return response.json();
  }

  /**
   * Retrieves a list of trending shows from Trakt.
   * 
   * @param {number} limit - Number of items to retrieve (default 20)
   * @returns {Promise<any[]>} List of trending shows
   */
  async getTrendingShows(limit: number = 20): Promise<any[]> {
    return this.fetch<any[]>(`/shows/trending?limit=${limit}`);
  }

  /**
   * Retrieves a list of trending movies from Trakt.
   * 
   * @param {number} limit - Number of items to retrieve (default 20)
   * @returns {Promise<any[]>} List of trending movies
   */
  async getTrendingMovies(limit: number = 20): Promise<any[]> {
    return this.fetch<any[]>(`/movies/trending?limit=${limit}`);
  }

  /**
   * Retrieves detailed ratings for a show (average, votes, distribution).
   * 
   * @param {string | number} idOrSlug - Trakt ID or Slug
   * @returns {Promise<{ rating: number; votes: number }>} Rating data
   */
  async getShowRatings(
    idOrSlug: string | number
  ): Promise<{ rating: number; votes: number; distribution?: Record<string, number> }> {
    return this.fetch(`/shows/${idOrSlug}/ratings`);
  }

  /**
   * Retrieves detailed ratings for a movie.
   * 
   * @param {string | number} idOrSlug - Trakt ID or Slug
   * @returns {Promise<{ rating: number; votes: number }>} Rating data
   */
  async getMovieRatings(
    idOrSlug: string | number
  ): Promise<{ rating: number; votes: number; distribution?: Record<string, number> }> {
    return this.fetch(`/movies/${idOrSlug}/ratings`);
  }

  /**
   * Get movie ratings and watchers by TMDB ID.
   * First looks up the Trakt ID, then fetches ratings and watchers.
   */
  async getMovieRatingsByTmdbId(tmdbId: number): Promise<{ rating: number; votes: number; watchers: number } | null> {
    try {
      // Step 1: Lookup Trakt ID by TMDB ID
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=movie`);
      if (!results.length || !results[0]?.movie?.ids?.trakt) {
        return null;
      }
      const traktId = results[0].movie.ids.trakt;

      // Step 2: Get ratings and watchers using Trakt ID (Parallel, resilient)
      const [ratingsResult, watchersResult] = await Promise.allSettled([
        this.getMovieRatings(traktId),
        this.getMovieWatchers(traktId)
      ]);

      if (ratingsResult.status === 'rejected') {
        throw ratingsResult.reason; // Critical failure if ratings fail
      }

      const ratings = ratingsResult.value;
      const watchers = watchersResult.status === 'fulfilled' ? watchersResult.value : 0;

      return { 
        rating: ratings.rating, 
        votes: ratings.votes,
        watchers: watchers
      };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt data for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }

  /**
   * Get show ratings and watchers by TMDB ID.
   * First looks up the Trakt ID, then fetches ratings.
   */
  async getShowRatingsByTmdbId(tmdbId: number): Promise<{ rating: number; votes: number; watchers: number } | null> {
    try {
      // Lookup Trakt ID by TMDB ID
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=show`);
      if (!results.length || !results[0]?.show?.ids?.trakt) {
        return null;
      }
      const traktId = results[0].show.ids.trakt;

      // Get ratings and watchers using Trakt ID (Parallel, resilient)
      const [ratingsResult, watchersResult] = await Promise.allSettled([
        this.getShowRatings(traktId),
        this.getShowWatchers(traktId)
      ]);

      if (ratingsResult.status === 'rejected') {
        throw ratingsResult.reason;
      }

      const ratings = ratingsResult.value;
      const watchers = watchersResult.status === 'fulfilled' ? watchersResult.value : 0;

      return { 
        rating: ratings.rating, 
        votes: ratings.votes,
        watchers: watchers
      };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt data for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }

  /**
   * Gets count of users currently watching a movie.
   *
   * @param {string | number} traktIdOrSlug - Trakt ID or slug of the movie
   * @returns {Promise<number>} Number of users watching right now (0 if error)
   */
  async getMovieWatchers(traktIdOrSlug: string | number): Promise<number> {
    try {
      const watchers = await this.fetch<any[]>(`/movies/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch {
      return 0;
    }
  }

  /**
   * Gets count of users currently watching a show.
   *
   * @param {string | number} traktIdOrSlug - Trakt ID or slug of the show
   * @returns {Promise<number>} Number of users watching right now (0 if error)
   */
  async getShowWatchers(traktIdOrSlug: string | number): Promise<number> {
    try {
      const watchers = await this.fetch<any[]>(`/shows/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch {
      return 0;
    }
  }

  /**
   * Gets trending movies with watchers count.
   * Returns list sorted by number of current watchers (most watched first).
   *
   * @param {number} limit - Maximum number of movies to return (default: 20)
   * @returns {Promise<Array>} Array of trending movies with tmdbId, watchers, and rank
   *
   * @example
   * const trending = await traktAdapter.getTrendingMoviesWithWatchers(10);
   * // [{ tmdbId: 550, watchers: 125, rank: 1 }, ...]
   */
  async getTrendingMoviesWithWatchers(limit = 20): Promise<Array<{
    tmdbId: number;
    watchers: number;
    rank: number;
  }>> {
    try {
      const trending = await this.fetch<any[]>(`/movies/trending?limit=${limit}`);
      return trending.map((item, index) => ({
        tmdbId: item.movie?.ids?.tmdb,
        watchers: item.watchers || 0,
        rank: index + 1,
      })).filter(item => item.tmdbId);
    } catch (error) {
      this.logger.warn(`Failed to get trending movies: ${error}`);
      return [];
    }
  }

  /**
   * Gets trending shows with watchers count.
   * Returns list sorted by number of current watchers (most watched first).
   *
   * @param {number} limit - Maximum number of shows to return (default: 20)
   * @returns {Promise<Array>} Array of trending shows with tmdbId, watchers, and rank
   *
   * @example
   * const trending = await traktAdapter.getTrendingShowsWithWatchers(10);
   * // [{ tmdbId: 66732, watchers: 89, rank: 1 }, ...]
   */
  async getTrendingShowsWithWatchers(limit = 20): Promise<Array<{
    tmdbId: number;
    watchers: number;
    rank: number;
  }>> {
    try {
      const trending = await this.fetch<any[]>(`/shows/trending?limit=${limit}`);
      return trending.map((item, index) => ({
        tmdbId: item.show?.ids?.tmdb,
        watchers: item.watchers || 0,
        rank: index + 1,
      })).filter(item => item.tmdbId);
    } catch (error) {
      this.logger.warn(`Failed to get trending shows: ${error}`);
      return [];
    }
  }

  /**
   * Gets Trakt ID for a show by TMDB ID.
   */
  async getTraktIdByTmdbId(tmdbId: number): Promise<number | null> {
    try {
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=show`);
      return results[0]?.show?.ids?.trakt || null;
    } catch {
      return null;
    }
  }

  /**
   * Gets all seasons for a show.
   */
  async getShowSeasons(traktId: number): Promise<Array<{
    number: number;
    episodeCount: number;
  }>> {
    try {
      const seasons = await this.fetch<any[]>(`/shows/${traktId}/seasons`);
      return seasons
        .filter((s: any) => s.number > 0) // Exclude specials
        .map((s: any) => ({
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
   */
  async getSeasonEpisodes(traktId: number, seasonNumber: number): Promise<Array<{
    number: number;
    title: string;
    rating: number;
    votes: number;
  }>> {
    try {
      const episodes = await this.fetch<any[]>(
        `/shows/${traktId}/seasons/${seasonNumber}?extended=full`
      );
      return episodes.map((ep: any) => ({
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
   */
  async getShowEpisodesForAnalysis(tmdbId: number): Promise<{
    traktId: number;
    seasons: Array<{
      number: number;
      episodes: Array<{
        number: number;
        title: string;
        rating: number;
        votes: number;
      }>;
    }>;
  } | null> {
    try {
      // Get Trakt ID
      const traktId = await this.getTraktIdByTmdbId(tmdbId);
      if (!traktId) return null;

      // Get seasons
      const seasons = await this.getShowSeasons(traktId);
      if (!seasons.length) return null;

      // Get episodes for each season (parallel, max 5 concurrent)
      const seasonData = await Promise.all(
        seasons.slice(0, 10).map(async (s) => ({
          number: s.number,
          episodes: await this.getSeasonEpisodes(traktId, s.number),
        }))
      );

      return {
        traktId,
        seasons: seasonData.filter(s => s.episodes.length > 0),
      };
    } catch (error) {
      this.logger.warn(`Failed to get episodes for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }
}
