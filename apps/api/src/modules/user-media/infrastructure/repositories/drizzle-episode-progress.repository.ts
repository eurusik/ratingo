import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type EpisodeBatchValidation,
  type EpisodeMediaInfo,
  type IEpisodeProgressRepository,
  type SeasonProgressInfo,
} from '../../domain/repositories/episode-progress.repository.interface';

@Injectable()
export class DrizzleEpisodeProgressRepository implements IEpisodeProgressRepository {
  private readonly logger = new Logger(DrizzleEpisodeProgressRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async markWatched(userId: string, episodeId: string): Promise<void> {
    try {
      await this.db
        .insert(schema.userEpisodeProgress)
        .values({
          userId,
          episodeId,
          watchedAt: new Date(),
        })
        .onConflictDoNothing();
    } catch (error) {
      this.logger.error(`markWatched failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to mark episode as watched', {
        userId,
        episodeId,
      });
    }
  }

  async markUnwatched(userId: string, episodeId: string): Promise<void> {
    try {
      await this.db
        .delete(schema.userEpisodeProgress)
        .where(
          and(
            eq(schema.userEpisodeProgress.userId, userId),
            eq(schema.userEpisodeProgress.episodeId, episodeId),
          ),
        );
    } catch (error) {
      this.logger.error(`markUnwatched failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to mark episode as unwatched', {
        userId,
        episodeId,
      });
    }
  }

  async markManyWatched(userId: string, episodeIds: string[]): Promise<void> {
    if (episodeIds.length === 0) return;
    try {
      await this.db
        .insert(schema.userEpisodeProgress)
        .values(
          episodeIds.map((episodeId) => ({
            userId,
            episodeId,
            watchedAt: new Date(),
          })),
        )
        .onConflictDoNothing();
    } catch (error) {
      this.logger.error(`markManyWatched failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to mark episodes as watched', {
        userId,
        count: episodeIds.length,
      });
    }
  }

  async markManyUnwatched(userId: string, episodeIds: string[]): Promise<void> {
    if (episodeIds.length === 0) return;
    try {
      await this.db
        .delete(schema.userEpisodeProgress)
        .where(
          and(
            eq(schema.userEpisodeProgress.userId, userId),
            inArray(schema.userEpisodeProgress.episodeId, episodeIds),
          ),
        );
    } catch (error) {
      this.logger.error(`markManyUnwatched failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to mark episodes as unwatched', {
        userId,
        count: episodeIds.length,
      });
    }
  }

  async getWatchedEpisodeIds(userId: string, showId: string): Promise<string[]> {
    try {
      const rows = await this.db
        .select({
          episodeId: schema.userEpisodeProgress.episodeId,
        })
        .from(schema.userEpisodeProgress)
        .innerJoin(schema.episodes, eq(schema.userEpisodeProgress.episodeId, schema.episodes.id))
        .where(
          and(eq(schema.userEpisodeProgress.userId, userId), eq(schema.episodes.showId, showId)),
        );

      return rows.map((r) => r.episodeId);
    } catch (error) {
      this.logger.error(`getWatchedEpisodeIds failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to get watched episode IDs', {
        userId,
        showId,
      });
    }
  }

  async getShowProgress(userId: string, showId: string): Promise<SeasonProgressInfo[]> {
    try {
      // Single query: all episodes with watched flag via correlated subquery
      const rows = await this.db
        .select({
          seasonNumber: schema.seasons.number,
          episodeId: schema.episodes.id,
          isWatched: sql<boolean>`
            EXISTS (
              SELECT 1 FROM ${schema.userEpisodeProgress}
              WHERE ${schema.userEpisodeProgress.episodeId} = ${schema.episodes.id}
              AND ${schema.userEpisodeProgress.userId} = ${userId}
            )
          `.as('is_watched'),
        })
        .from(schema.seasons)
        .innerJoin(schema.episodes, eq(schema.episodes.seasonId, schema.seasons.id))
        .where(eq(schema.seasons.showId, showId))
        .orderBy(schema.seasons.number, schema.episodes.number);

      const seasonMap = new Map<number, { total: number; watched: number; watchedIds: string[] }>();

      for (const row of rows) {
        const existing = seasonMap.get(row.seasonNumber) || {
          total: 0,
          watched: 0,
          watchedIds: [],
        };
        existing.total++;
        if (row.isWatched) {
          existing.watched++;
          existing.watchedIds.push(row.episodeId);
        }
        seasonMap.set(row.seasonNumber, existing);
      }

      const result: SeasonProgressInfo[] = [];
      for (const [seasonNumber, data] of seasonMap) {
        result.push({
          seasonNumber,
          watchedCount: data.watched,
          totalCount: data.total,
          watchedEpisodeIds: data.watchedIds,
        });
      }

      return result.sort((a, b) => a.seasonNumber - b.seasonNumber);
    } catch (error) {
      this.logger.error(`getShowProgress failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to get show progress', {
        userId,
        showId,
      });
    }
  }

  async validateEpisodeBatch(episodeIds: string[]): Promise<EpisodeBatchValidation> {
    if (episodeIds.length === 0) return { existingCount: 0, distinctShowCount: 0 };
    try {
      const [row] = await this.db
        .select({
          existingCount: sql<number>`count(*)`,
          distinctShowCount: sql<number>`count(distinct ${schema.episodes.showId})`,
        })
        .from(schema.episodes)
        .where(inArray(schema.episodes.id, episodeIds));

      return {
        existingCount: Number(row?.existingCount ?? 0),
        distinctShowCount: Number(row?.distinctShowCount ?? 0),
      };
    } catch (error) {
      this.logger.error(`validateEpisodeBatch failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to validate episode batch', {
        count: episodeIds.length,
      });
    }
  }

  async getEpisodeMediaInfo(episodeId: string): Promise<EpisodeMediaInfo | null> {
    try {
      const rows = await this.db
        .select({
          episodeId: schema.episodes.id,
          showId: schema.episodes.showId,
          mediaItemId: schema.shows.mediaItemId,
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
        .innerJoin(schema.shows, eq(schema.episodes.showId, schema.shows.id))
        .where(eq(schema.episodes.id, episodeId))
        .limit(1);

      return rows[0] ?? null;
    } catch (error) {
      this.logger.error(`getEpisodeMediaInfo failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to get episode media info', {
        episodeId,
      });
    }
  }
}
