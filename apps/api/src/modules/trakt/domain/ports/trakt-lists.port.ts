/**
 * Port interface for trending lists operations.
 * Abstracts external API calls for trending media with watchers data.
 */
export interface TraktListsPort {
  /**
   * Gets trending movies with watchers count and rank.
   *
   * @param {number} limit - Max items to fetch
   * @returns {Promise<Array<{ tmdbId: number; watchers: number; rank: number }>>} Trending movies
   */
  getTrendingMoviesWithWatchers(
    limit?: number,
  ): Promise<Array<{ tmdbId: number; watchers: number; rank: number }>>;

  /**
   * Gets trending shows with watchers count and rank.
   *
   * @param {number} limit - Max items to fetch
   * @returns {Promise<Array<{ tmdbId: number; watchers: number; rank: number }>>} Trending shows
   */
  getTrendingShowsWithWatchers(
    limit?: number,
  ): Promise<Array<{ tmdbId: number; watchers: number; rank: number }>>;
}

/**
 * Injection token for TraktListsPort.
 */
export const TRAKT_LISTS_PORT = Symbol('TRAKT_LISTS_PORT');
