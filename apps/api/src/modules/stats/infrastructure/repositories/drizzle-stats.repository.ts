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
            watchersCount: stats.watchersCount,
            trendingRank: stats.trendingRank,
            popularity24h: stats.popularity24h,
            ratingoScore: stats.ratingoScore,
            qualityScore: stats.qualityScore,
            popularityScore: stats.popularityScore,
            freshnessScore: stats.freshnessScore,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              watchersCount: stats.watchersCount,
              trendingRank: stats.trendingRank,
              popularity24h: stats.popularity24h,
              ratingoScore: stats.ratingoScore,
              qualityScore: stats.qualityScore,
              popularityScore: stats.popularityScore,
              freshnessScore: stats.freshnessScore,
              updatedAt: new Date(),
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
          watchersCount: stat.watchersCount,
          trendingRank: stat.trendingRank,
          popularity24h: stat.popularity24h,
          ratingoScore: stat.ratingoScore,
          qualityScore: stat.qualityScore,
          popularityScore: stat.popularityScore,
          freshnessScore: stat.freshnessScore,
          updatedAt: now,
        }));

        await this.db
          .insert(schema.mediaStats)
          .values(values)
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              watchersCount: sql`excluded.watchers_count`,
              trendingRank: sql`excluded.trending_rank`,
              popularity24h: sql`excluded.popularity_24h`,
              ratingoScore: sql`excluded.ratingo_score`,
              qualityScore: sql`excluded.quality_score`,
              popularityScore: sql`excluded.popularity_score`,
              freshnessScore: sql`excluded.freshness_score`,
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
        };
      },
      { tmdbId },
    );
  }
}
