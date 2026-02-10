export const COMMUNITY_RATING_AGGREGATION_PORT = Symbol('COMMUNITY_RATING_AGGREGATION_PORT');

/**
 * Aggregated community rating data for a single media item.
 */
export interface CommunityRatingAggregation {
  averageRating: number;
  ratingCount: number;
}

/**
 * Port for aggregating community ratings from user rating data.
 * Infrastructure layer implements this to query the actual data source.
 */
export interface ICommunityRatingAggregationPort {
  /**
   * Aggregates ratings for a single media item.
   *
   * @param mediaItemId - Internal UUID of the media item
   * @returns Aggregation result or null if no ratings exist
   */
  aggregateForMediaItem(mediaItemId: string): Promise<CommunityRatingAggregation | null>;

  /**
   * Aggregates ratings for all media items that have at least one rating.
   *
   * @returns Map of mediaItemId to aggregation result
   */
  aggregateAll(): Promise<Map<string, CommunityRatingAggregation>>;
}
