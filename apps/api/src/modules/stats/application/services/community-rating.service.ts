import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  COMMUNITY_RATING_AGGREGATION_PORT,
  type ICommunityRatingAggregationPort,
} from '../../domain/ports/community-rating-aggregation.port';
import {
  STATS_REPOSITORY,
  type IStatsRepository,
} from '../../domain/repositories/stats.repository.interface';

/** Multiplier for rounding to 2 decimal places. */
const ROUNDING_PRECISION = 100;

/** Rounds a number to 2 decimal places. */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

/**
 * Service responsible for recalculating community average ratings.
 * Aggregates user ratings from user_media_state and persists to media_stats.
 */
@Injectable()
export class CommunityRatingService {
  private readonly logger = new Logger(CommunityRatingService.name);

  constructor(
    @Inject(COMMUNITY_RATING_AGGREGATION_PORT)
    private readonly aggregationPort: ICommunityRatingAggregationPort,
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  /**
   * Recalculates the community average rating for a single media item.
   * Resets to 0 if no ratings exist.
   *
   * @param mediaItemId - Internal UUID of the media item
   */
  async recalculateForMediaItem(mediaItemId: string): Promise<void> {
    const agg = await this.aggregationPort.aggregateForMediaItem(mediaItemId);

    if (!agg || agg.ratingCount === 0) {
      await this.statsRepository.updateCommunityRating(mediaItemId, 0, 0);
      return;
    }

    await this.statsRepository.updateCommunityRating(
      mediaItemId,
      roundToTwoDecimals(agg.averageRating),
      agg.ratingCount,
    );
  }

  /**
   * Reconciles community ratings for all media items that have user ratings.
   * Also resets stale ratings for items whose ratings were all deleted.
   * Intended for periodic batch reconciliation via background job.
   *
   * @returns Object with the number of items updated and reset
   */
  async reconcileAll(): Promise<{ updated: number; reset: number }> {
    const allAggregations = await this.aggregationPort.aggregateAll();

    const stats = Array.from(allAggregations.entries()).map(([mediaItemId, agg]) => ({
      mediaItemId,
      communityAverageRating: roundToTwoDecimals(agg.averageRating),
      communityRatingCount: agg.ratingCount,
    }));

    if (stats.length > 0) {
      await this.statsRepository.bulkUpsert(stats);
    }

    // Reset stale community ratings for items that no longer have any user ratings
    const existingIds = await this.aggregationPort.findMediaItemIdsWithCommunityRatings();
    const freshIds = new Set(allAggregations.keys());
    const staleIds = existingIds.filter((id) => !freshIds.has(id));

    if (staleIds.length > 0) {
      await this.statsRepository.bulkUpsert(
        staleIds.map((mediaItemId) => ({
          mediaItemId,
          communityAverageRating: 0,
          communityRatingCount: 0,
        })),
      );
      this.logger.log(`Reset stale community ratings for ${staleIds.length} media items`);
    }

    this.logger.log(`Reconciled community ratings for ${stats.length} media items`);
    return { updated: stats.length, reset: staleIds.length };
  }
}
