import { Injectable } from '@nestjs/common';
import { BaseTraktHttp } from './base-trakt-http';

/**
 * Trakt adapter for trending lists and watchers ranks.
 */
@Injectable()
export class TraktListsAdapter extends BaseTraktHttp {
  /**
   * Gets trending movies with watchers and rank.
   */
  async getTrendingMoviesWithWatchers(limit = 20): Promise<
    Array<{
      tmdbId: number;
      watchers: number;
      rank: number;
    }>
  > {
    try {
      const trending = await this.fetch<any[]>(`/movies/trending?limit=${limit}`);
      return trending
        .map((item, index) => ({
          tmdbId: item.movie?.ids?.tmdb,
          watchers: item.watchers || 0,
          rank: index + 1,
        }))
        .filter((item) => item.tmdbId);
    } catch (error) {
      this.logger.warn(`Failed to get trending movies: ${error}`);
      return [];
    }
  }

  /**
   * Gets trending shows with watchers and rank.
   */
  async getTrendingShowsWithWatchers(limit = 20): Promise<
    Array<{
      tmdbId: number;
      watchers: number;
      rank: number;
    }>
  > {
    try {
      const trending = await this.fetch<any[]>(`/shows/trending?limit=${limit}`);
      return trending
        .map((item, index) => ({
          tmdbId: item.show?.ids?.tmdb,
          watchers: item.watchers || 0,
          rank: index + 1,
        }))
        .filter((item) => item.tmdbId);
    } catch (error) {
      this.logger.warn(`Failed to get trending shows: ${error}`);
      return [];
    }
  }
}
