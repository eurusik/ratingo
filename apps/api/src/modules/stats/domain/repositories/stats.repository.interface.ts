/**
 * Injection token for the Stats Repository.
 */
export const STATS_REPOSITORY = Symbol('STATS_REPOSITORY');

/**
 * Data transfer object for media statistics.
 * Contains real-time metrics like watchers count and trending position.
 */
export interface MediaStatsData {
  /** Internal media item UUID */
  mediaItemId: string;
  /** Number of users currently watching this media on Trakt */
  watchersCount: number;
  /** Position in the trending list (1 = most trending) */
  trendingRank?: number;
  /** Popularity score over the last 24 hours */
  popularity24h?: number;
  /** Main Ratingo composite score (0-1) */
  ratingoScore?: number;
  /** Quality/rating component score (0-1) */
  qualityScore?: number;
  /** Popularity component score (0-1) */
  popularityScore?: number;
  /** Freshness/recency component score (0-1) */
  freshnessScore?: number;
}

/**
 * Repository interface for media statistics operations.
 * Handles fast-changing data like watchers count and trending metrics.
 */
export interface IStatsRepository {
  /**
   * Upserts stats for a single media item.
   *
   * @param {MediaStatsData} stats - Stats data to upsert
   * @returns {Promise<void>} Nothing
   */
  upsert(stats: MediaStatsData): Promise<void>;

  /**
   * Bulk upserts stats for multiple media items.
   * More efficient than calling upsert() in a loop.
   *
   * @param {MediaStatsData[]} stats - Array of stats data to upsert
   * @returns {Promise<void>} Nothing
   */
  bulkUpsert(stats: MediaStatsData[]): Promise<void>;

  /**
   * Finds stats by internal media item ID.
   *
   * @param {string} mediaItemId - Internal UUID of the media item
   * @returns {Promise<MediaStatsData | null>} Stats or null if not found
   */
  findByMediaItemId(mediaItemId: string): Promise<MediaStatsData | null>;

  /**
   * Finds stats by TMDB ID.
   * Performs a join with media_items table.
   *
   * @param {number} tmdbId - TMDB ID of the media item
   * @returns {Promise<MediaStatsData | null>} Stats or null if not found
   */
  findByTmdbId(tmdbId: number): Promise<MediaStatsData | null>;
}
