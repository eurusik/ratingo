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
 */
export interface TraktRatingsPort {
  /**
   * Gets watchers count for multiple movies by TMDB IDs.
   *
   * @param {number[]} tmdbIds - TMDB IDs
   * @param {number} concurrency - Max concurrent requests
   * @returns {Promise<Map<number, number | null>>} Map of tmdbId -> watchers (null = error)
   */
  getMovieWatchersByTmdbIds(
    tmdbIds: number[],
    concurrency?: number,
  ): Promise<Map<number, number | null>>;

  /**
   * Gets watchers count for multiple shows by TMDB IDs.
   *
   * @param {number[]} tmdbIds - TMDB IDs
   * @param {number} concurrency - Max concurrent requests
   * @returns {Promise<Map<number, number | null>>} Map of tmdbId -> watchers (null = error)
   */
  getShowWatchersByTmdbIds(
    tmdbIds: number[],
    concurrency?: number,
  ): Promise<Map<number, number | null>>;

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
}

/**
 * Injection token for TraktRatingsPort.
 */
export const TRAKT_RATINGS_PORT = Symbol('TRAKT_RATINGS_PORT');
