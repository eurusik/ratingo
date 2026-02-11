import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type IStatsRepository,
  type MediaStatsData,
} from '../../domain/repositories/stats.repository.interface';

/**
 * Drizzle ORM implementation of the Stats Repository.
 * Handles persistence of fast-changing media statistics to PostgreSQL.
 */
@Injectable()
export class DrizzleStatsRepository implements IStatsRepository {
  private readonly logger = new Logger(DrizzleStatsRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async upsert(stats: MediaStatsData): Promise<void> {
    return withDbError(
      'upsert stats',
      this.logger,
      async () => {
        await this.db
          .insert(schema.mediaStats)
          .values({
            mediaItemId: stats.mediaItemId,
            watchersCount: stats.watchersCount ?? null,
            trendingRank: stats.trendingRank ?? null,
            popularity24h: stats.popularity24h ?? null,
            ratingoScore: stats.ratingoScore ?? null,
            qualityScore: stats.qualityScore ?? null,
            popularityScore: stats.popularityScore ?? null,
            freshnessScore: stats.freshnessScore ?? null,
            communityAverageRating: stats.communityAverageRating ?? null,
            communityRatingCount: stats.communityRatingCount ?? null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              // Use COALESCE to preserve existing values when new value is NULL
              watchersCount: sql`COALESCE(excluded.watchers_count, media_stats.watchers_count)`,
              trendingRank: sql`COALESCE(excluded.trending_rank, media_stats.trending_rank)`,
              popularity24h: sql`COALESCE(excluded.popularity_24h, media_stats.popularity_24h)`,
              ratingoScore: sql`COALESCE(excluded.ratingo_score, media_stats.ratingo_score)`,
              qualityScore: sql`COALESCE(excluded.quality_score, media_stats.quality_score)`,
              popularityScore: sql`COALESCE(excluded.popularity_score, media_stats.popularity_score)`,
              freshnessScore: sql`COALESCE(excluded.freshness_score, media_stats.freshness_score)`,
              communityAverageRating: sql`COALESCE(excluded.community_average_rating, media_stats.community_average_rating)`,
              communityRatingCount: sql`COALESCE(excluded.community_rating_count, media_stats.community_rating_count)`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      },
      { mediaItemId: stats.mediaItemId },
    );
  }

  async bulkUpsert(stats: MediaStatsData[]): Promise<void> {
    if (stats.length === 0) return;

    return withDbError(
      'bulk upsert stats',
      this.logger,
      async () => {
        const now = new Date();
        const values = stats.map((stat) => ({
          mediaItemId: stat.mediaItemId,
          watchersCount: stat.watchersCount ?? null,
          trendingRank: stat.trendingRank ?? null,
          popularity24h: stat.popularity24h ?? null,
          ratingoScore: stat.ratingoScore ?? null,
          qualityScore: stat.qualityScore ?? null,
          popularityScore: stat.popularityScore ?? null,
          freshnessScore: stat.freshnessScore ?? null,
          communityAverageRating: stat.communityAverageRating ?? null,
          communityRatingCount: stat.communityRatingCount ?? null,
          updatedAt: now,
        }));

        await this.db
          .insert(schema.mediaStats)
          .values(values)
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              // Use COALESCE to preserve existing values when new value is NULL
              watchersCount: sql`COALESCE(excluded.watchers_count, media_stats.watchers_count)`,
              trendingRank: sql`COALESCE(excluded.trending_rank, media_stats.trending_rank)`,
              popularity24h: sql`COALESCE(excluded.popularity_24h, media_stats.popularity_24h)`,
              ratingoScore: sql`COALESCE(excluded.ratingo_score, media_stats.ratingo_score)`,
              qualityScore: sql`COALESCE(excluded.quality_score, media_stats.quality_score)`,
              popularityScore: sql`COALESCE(excluded.popularity_score, media_stats.popularity_score)`,
              freshnessScore: sql`COALESCE(excluded.freshness_score, media_stats.freshness_score)`,
              communityAverageRating: sql`COALESCE(excluded.community_average_rating, media_stats.community_average_rating)`,
              communityRatingCount: sql`COALESCE(excluded.community_rating_count, media_stats.community_rating_count)`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      },
      { count: stats.length },
    );
  }

  async findByMediaItemId(mediaItemId: string): Promise<MediaStatsData | null> {
    return withDbError(
      'find stats by media ID',
      this.logger,
      async () => {
        const result = await this.db
          .select()
          .from(schema.mediaStats)
          .where(eq(schema.mediaStats.mediaItemId, mediaItemId))
          .limit(1);

        if (!result.length) return null;

        return {
          mediaItemId: result[0].mediaItemId,
          watchersCount: result[0].watchersCount ?? 0,
          trendingRank: result[0].trendingRank ?? undefined,
          popularity24h: result[0].popularity24h ?? undefined,
          communityAverageRating: result[0].communityAverageRating ?? undefined,
          communityRatingCount: result[0].communityRatingCount ?? undefined,
        };
      },
      { mediaItemId },
    );
  }

  async findByTmdbId(tmdbId: number): Promise<MediaStatsData | null> {
    return withDbError(
      'find stats by TMDB ID',
      this.logger,
      async () => {
        const result = await this.db
          .select({
            mediaItemId: schema.mediaStats.mediaItemId,
            watchersCount: schema.mediaStats.watchersCount,
            trendingRank: schema.mediaStats.trendingRank,
            popularity24h: schema.mediaStats.popularity24h,
            communityAverageRating: schema.mediaStats.communityAverageRating,
            communityRatingCount: schema.mediaStats.communityRatingCount,
          })
          .from(schema.mediaStats)
          .innerJoin(schema.mediaItems, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(eq(schema.mediaItems.tmdbId, tmdbId))
          .limit(1);

        if (!result.length) return null;

        return {
          mediaItemId: result[0].mediaItemId,
          watchersCount: result[0].watchersCount ?? 0,
          trendingRank: result[0].trendingRank ?? undefined,
          popularity24h: result[0].popularity24h ?? undefined,
          communityAverageRating: result[0].communityAverageRating ?? undefined,
          communityRatingCount: result[0].communityRatingCount ?? undefined,
        };
      },
      { tmdbId },
    );
  }

  /**
   * Upserts only the total_watchers field for a media item.
   * Used for backfilling corrupted data.
   * Uses INSERT ON CONFLICT to handle missing rows.
   */
  async updateTotalWatchers(mediaItemId: string, totalWatchers: number): Promise<void> {
    return withDbError(
      'upsert total watchers',
      this.logger,
      async () => {
        await this.db
          .insert(schema.mediaStats)
          .values({
            mediaItemId,
            totalWatchers,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              totalWatchers,
              updatedAt: new Date(),
            },
          });
      },
      { mediaItemId, totalWatchers },
    );
  }

  /**
   * Upserts only the watchers_count field for a media item.
   * Used for backfilling corrupted live watchers data.
   * Uses INSERT ON CONFLICT to handle missing rows.
   */
  async updateWatchersCount(mediaItemId: string, watchersCount: number): Promise<void> {
    return withDbError(
      'upsert watchers count',
      this.logger,
      async () => {
        await this.db
          .insert(schema.mediaStats)
          .values({
            mediaItemId,
            watchersCount,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              watchersCount,
              updatedAt: new Date(),
            },
          });
      },
      { mediaItemId, watchersCount },
    );
  }

  /**
   * Upserts community rating fields for a media item.
   * Creates the stats row if it doesn't exist.
   * Uses INSERT ON CONFLICT to handle missing rows.
   */
  async updateCommunityRating(
    mediaItemId: string,
    averageRating: number,
    ratingCount: number,
  ): Promise<void> {
    return withDbError(
      'upsert community rating',
      this.logger,
      async () => {
        await this.db
          .insert(schema.mediaStats)
          .values({
            mediaItemId,
            communityAverageRating: averageRating,
            communityRatingCount: ratingCount,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              communityAverageRating: averageRating,
              communityRatingCount: ratingCount,
              updatedAt: new Date(),
            },
          });
      },
      { mediaItemId, averageRating, ratingCount },
    );
  }
}
