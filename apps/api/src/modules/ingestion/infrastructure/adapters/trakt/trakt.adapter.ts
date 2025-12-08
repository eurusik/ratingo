import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import traktConfig from '@/config/trakt.config';
import { TraktApiException } from '@/common/exceptions';

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
   * Get movie ratings by TMDB ID.
   * First looks up the Trakt ID, then fetches ratings.
   */
  async getMovieRatingsByTmdbId(tmdbId: number): Promise<{ rating: number; votes: number } | null> {
    try {
      // Step 1: Lookup Trakt ID by TMDB ID
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=movie`);
      if (!results.length || !results[0]?.movie?.ids?.trakt) {
        return null;
      }
      const traktId = results[0].movie.ids.trakt;

      // Step 2: Get ratings using Trakt ID
      const ratings = await this.getMovieRatings(traktId);
      return { rating: ratings.rating, votes: ratings.votes };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt ratings for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }

  /**
   * Get show ratings by TMDB ID.
   * First looks up the Trakt ID, then fetches ratings.
   */
  async getShowRatingsByTmdbId(tmdbId: number): Promise<{ rating: number; votes: number } | null> {
    try {
      // Step 1: Lookup Trakt ID by TMDB ID
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=show`);
      if (!results.length || !results[0]?.show?.ids?.trakt) {
        return null;
      }
      const traktId = results[0].show.ids.trakt;

      // Step 2: Get ratings using Trakt ID
      const ratings = await this.getShowRatings(traktId);
      return { rating: ratings.rating, votes: ratings.votes };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt ratings for TMDB ${tmdbId}: ${error}`);
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
}
