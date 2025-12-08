import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import traktConfig from '@/config/trakt.config';

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
      throw new Error('Trakt Client ID is not configured');
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
      throw new Error(`Trakt API error: ${response.status} ${response.statusText}`);
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
}
