/**
 * Episode data for drop-off analysis.
 */
export interface EpisodeAnalysisData {
  number: number;
  title: string;
  rating: number;
  votes: number;
}

/**
 * Season data for drop-off analysis.
 */
export interface SeasonAnalysisData {
  number: number;
  episodes: EpisodeAnalysisData[];
}

/**
 * Show episodes payload for drop-off analysis.
 */
export interface ShowEpisodesAnalysisPayload {
  traktId: number;
  seasons: SeasonAnalysisData[];
}

/**
 * Port interface for ratings and watchers operations.
 * Abstracts external API calls for media ratings and viewer statistics.
 *
 * Return value semantics for watchers methods:
 * - number (including 0) = success, update DB
 * - undefined = not found in Trakt, can write 0 or skip
 * - null = transient error (429/5xx), skip DB update
 */
export interface TraktRatingsPort {
  /**
   * Gets watchers count for multiple movies by TMDB IDs.
   *
   * @param tmdbIds - TMDB IDs
   * @param concurrency - Max concurrent requests
   * @returns Map of tmdbId -> watchers
   */
  getMovieWatchersByTmdbIds(
    tmdbIds: number[],
    concurrency?: number,
  ): Promise<Map<number, number | null | undefined>>;

  /**
   * Gets watchers count for multiple shows by TMDB IDs.
   *
   * @param tmdbIds - TMDB IDs
   * @param concurrency - Max concurrent requests
   * @returns Map of tmdbId -> watchers
   */
  getShowWatchersByTmdbIds(
    tmdbIds: number[],
    concurrency?: number,
  ): Promise<Map<number, number | null | undefined>>;

  /**
   * Gets all episodes for a show for drop-off analysis.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<ShowEpisodesAnalysisPayload | null>} Analysis payload or null
   */
  getShowEpisodesForAnalysis(tmdbId: number): Promise<ShowEpisodesAnalysisPayload | null>;

  /**
   * Gets stats (total watchers) for a movie by TMDB ID.
   * Used for backfilling corrupted data.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ watchers: number } | null>} Stats or null if not found
   */
  getMovieStatsByTmdbId(tmdbId: number): Promise<{ watchers: number } | null>;

  /**
   * Gets stats (total watchers) for a show by TMDB ID.
   * Used for backfilling corrupted data.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ watchers: number } | null>} Stats or null if not found
   */
  getShowStatsByTmdbId(tmdbId: number): Promise<{ watchers: number } | null>;

  /**
   * Gets total watchers count for multiple items by TMDB IDs.
   * Optimized for batch operations: uses 2 API calls per item (search + stats).
   *
   * Return value semantics:
   * - number (including 0) = success, update DB
   * - undefined = not found in Trakt, can write 0 or skip
   * - null = transient error (429/5xx), skip DB update
   *
   * @param type - Media type ('movie' | 'show')
   * @param tmdbIds - Array of TMDB IDs
   * @returns Map of tmdbId -> totalWatchers
   */
  getTotalWatchersByTmdbIds(
    type: 'movie' | 'show',
    tmdbIds: number[],
  ): Promise<Map<number, number | null | undefined>>;
}

/**
 * Injection token for TraktRatingsPort.
 */
export const TRAKT_RATINGS_PORT = Symbol('TRAKT_RATINGS_PORT');
