import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq } from 'drizzle-orm';
import {
  IStatsRepository,
  MediaStatsData,
} from '../../domain/repositories/stats.repository.interface';
import { DatabaseException } from '../../../../common/exceptions';

/**
 * Drizzle ORM implementation of the Stats Repository.
 * Handles persistence of fast-changing media statistics to PostgreSQL.
 */
@Injectable()
export class DrizzleStatsRepository implements IStatsRepository {
  private readonly logger = new Logger(DrizzleStatsRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>
  ) {}

  async upsert(stats: MediaStatsData): Promise<void> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to upsert stats: ${error.message}`);
      throw new DatabaseException(`Failed to upsert stats: ${error.message}`, {
        mediaItemId: stats.mediaItemId,
      });
    }
  }

  async bulkUpsert(stats: MediaStatsData[]): Promise<void> {
    if (stats.length === 0) return;

    try {
      // Process each stat individually to ensure correct values on conflict
      for (const stat of stats) {
        await this.db
          .insert(schema.mediaStats)
          .values({
            mediaItemId: stat.mediaItemId,
            watchersCount: stat.watchersCount,
            trendingRank: stat.trendingRank,
            popularity24h: stat.popularity24h,
            ratingoScore: stat.ratingoScore,
            qualityScore: stat.qualityScore,
            popularityScore: stat.popularityScore,
            freshnessScore: stat.freshnessScore,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.mediaStats.mediaItemId,
            set: {
              watchersCount: stat.watchersCount,
              trendingRank: stat.trendingRank,
              popularity24h: stat.popularity24h,
              ratingoScore: stat.ratingoScore,
              qualityScore: stat.qualityScore,
              popularityScore: stat.popularityScore,
              freshnessScore: stat.freshnessScore,
              updatedAt: new Date(),
            },
          });
      }
    } catch (error) {
      this.logger.error(`Failed to bulk upsert stats: ${error.message}`);
      throw new DatabaseException(`Failed to bulk upsert stats: ${error.message}`, {
        count: stats.length,
      });
    }
  }

  async findByMediaItemId(mediaItemId: string): Promise<MediaStatsData | null> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to find stats by media ID: ${error.message}`);
      throw new DatabaseException(`Failed to find stats: ${error.message}`, { mediaItemId });
    }
  }

  async findByTmdbId(tmdbId: number): Promise<MediaStatsData | null> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to find stats by TMDB ID: ${error.message}`);
      throw new DatabaseException(`Failed to find stats: ${error.message}`, { tmdbId });
    }
  }
}
