/**
 * Injection token for episode progress repository.
 */
export const EPISODE_PROGRESS_REPOSITORY = Symbol('EPISODE_PROGRESS_REPOSITORY');

/**
 * Season progress information.
 */
export interface SeasonProgressInfo {
  seasonNumber: number;
  watchedCount: number;
  totalCount: number;
  watchedEpisodeIds: string[];
}

/**
 * Repository contract for episode watch progress operations.
 */
export interface IEpisodeProgressRepository {
  /**
   * Marks an episode as watched.
   *
   * @param {string} userId - User identifier
   * @param {string} episodeId - Episode identifier
   * @returns {Promise<void>}
   */
  markWatched(userId: string, episodeId: string): Promise<void>;

  /**
   * Marks an episode as unwatched.
   *
   * @param {string} userId - User identifier
   * @param {string} episodeId - Episode identifier
   * @returns {Promise<void>}
   */
  markUnwatched(userId: string, episodeId: string): Promise<void>;

  /**
   * Gets progress for all seasons of a show.
   *
   * @param {string} userId - User identifier
   * @param {string} showId - Show identifier (from shows table, not media_items)
   * @returns {Promise<SeasonProgressInfo[]>} Progress per season
   */
  getShowProgress(userId: string, showId: string): Promise<SeasonProgressInfo[]>;

  /**
   * Gets watched episode IDs for a show.
   *
   * @param {string} userId - User identifier
   * @param {string} showId - Show identifier
   * @returns {Promise<string[]>} Watched episode IDs
   */
  getWatchedEpisodeIds(userId: string, showId: string): Promise<string[]>;
}
