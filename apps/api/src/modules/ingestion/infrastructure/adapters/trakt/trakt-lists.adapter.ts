import { Injectable } from '@nestjs/common';
import { BaseTraktHttp } from './base-trakt-http';
import {
  TraktTrendingMovie,
  TraktTrendingShow,
  TraktEndpoint,
  TRAKT_ENDPOINT,
} from './interfaces/trakt.types';
import { TraktListsPort } from '../../../domain/ports/trakt-lists.port';

/**
 * Trakt adapter for trending lists and watchers ranks.
 * Implements TraktListsPort for DDD compliance.
 */
@Injectable()
export class TraktListsAdapter extends BaseTraktHttp implements TraktListsPort {
  /**
   * Generic method to get trending items with watchers and rank.
   *
   * @param {'movies' | 'shows'} endpoint - API endpoint type
   * @param {number} limit - Max items to fetch
   * @returns {Promise<Array<{ tmdbId: number; watchers: number; rank: number }>>} Trending items
   */
  private async getTrendingWithWatchers(
    endpoint: TraktEndpoint,
    limit: number,
  ): Promise<Array<{ tmdbId: number; watchers: number; rank: number }>> {
    try {
      const trending = await this.fetch<(TraktTrendingMovie | TraktTrendingShow)[]>(
        `/${endpoint}/trending?limit=${limit}`,
      );
      return trending
        .map((item, index) => {
          const media = 'movie' in item ? item.movie : item.show;
          return {
            tmdbId: media?.ids?.tmdb,
            watchers: item.watchers || 0,
            rank: index + 1,
          };
        })
        .filter(
          (item): item is { tmdbId: number; watchers: number; rank: number } => !!item.tmdbId,
        );
    } catch (error) {
      this.logger.warn(`Failed to get trending ${endpoint}: ${error}`);
      return [];
    }
  }

  /**
   * Gets trending movies with watchers and rank.
   *
   * @param {number} limit - Max items to fetch
   * @returns {Promise<Array<{ tmdbId: number; watchers: number; rank: number }>>} Trending movies with watchers and rank
   */
  async getTrendingMoviesWithWatchers(limit = 20): Promise<
    Array<{
      tmdbId: number;
      watchers: number;
      rank: number;
    }>
  > {
    return this.getTrendingWithWatchers(TRAKT_ENDPOINT.MOVIES, limit);
  }

  /**
   * Gets trending shows with watchers and rank.
   *
   * @param {number} limit - Max items to fetch
   * @returns {Promise<Array<{ tmdbId: number; watchers: number; rank: number }>>} Trending shows with watchers and rank
   */
  async getTrendingShowsWithWatchers(limit = 20): Promise<
    Array<{
      tmdbId: number;
      watchers: number;
      rank: number;
    }>
  > {
    return this.getTrendingWithWatchers(TRAKT_ENDPOINT.SHOWS, limit);
  }
}
