import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, gt, isNotNull, eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type CommunityRatingAggregation,
  type ICommunityRatingAggregationPort,
} from '../../domain/ports/community-rating-aggregation.port';

/**
 * Drizzle-based implementation of the community rating aggregation port.
 * Queries user_media_state to compute average ratings per media item.
 */
@Injectable()
export class CommunityRatingAggregationQuery implements ICommunityRatingAggregationPort {
  private readonly logger = new Logger(CommunityRatingAggregationQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Aggregates community ratings for a single media item.
   * Returns null when there are no ratings.
   */
  async aggregateForMediaItem(mediaItemId: string): Promise<CommunityRatingAggregation | null> {
    return withDbError(
      'aggregate community rating for media item',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            averageRating: sql<number>`AVG(${schema.userMediaState.rating})::float`,
            ratingCount: sql<number>`COUNT(${schema.userMediaState.rating})::int`,
          })
          .from(schema.userMediaState)
          .where(
            and(
              eq(schema.userMediaState.mediaItemId, mediaItemId),
              isNotNull(schema.userMediaState.rating),
            ),
          );

        if (!result.length || result[0].ratingCount === 0) {
          return null;
        }

        return {
          averageRating: result[0].averageRating,
          ratingCount: result[0].ratingCount,
        };
      },
      { mediaItemId },
    );
  }

  /**
   * Aggregates community ratings for all media items that have at least one rating.
   * Returns a Map keyed by mediaItemId.
   */
  async aggregateAll(): Promise<Map<string, CommunityRatingAggregation>> {
    return withDbError('aggregate all community ratings', this.logger, async () => {
      const rows = await this.db
        .select({
          mediaItemId: schema.userMediaState.mediaItemId,
          averageRating: sql<number>`AVG(${schema.userMediaState.rating})::float`,
          ratingCount: sql<number>`COUNT(${schema.userMediaState.rating})::int`,
        })
        .from(schema.userMediaState)
        .where(isNotNull(schema.userMediaState.rating))
        .groupBy(schema.userMediaState.mediaItemId);

      const map = new Map<string, CommunityRatingAggregation>();
      for (const row of rows) {
        if (row.ratingCount > 0) {
          map.set(row.mediaItemId, {
            averageRating: row.averageRating,
            ratingCount: row.ratingCount,
          });
        }
      }
      return map;
    });
  }

  /**
   * Returns IDs of media items that currently have non-zero community ratings in media_stats.
   */
  async findMediaItemIdsWithCommunityRatings(): Promise<string[]> {
    return withDbError('find media items with community ratings', this.logger, async () => {
      const rows = await this.db
        .select({ mediaItemId: schema.mediaStats.mediaItemId })
        .from(schema.mediaStats)
        .where(gt(schema.mediaStats.communityRatingCount, 0));

      return rows.map((row) => row.mediaItemId);
    });
  }
}
