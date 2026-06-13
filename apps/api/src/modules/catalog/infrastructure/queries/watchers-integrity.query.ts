import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, desc } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type CorruptedWatchersItem } from '../../domain/repositories/media.repository.interface';

import { buildMissingWatchersConditions, buildCorruptedWatchersCountConditions } from './shared';

/**
 * Finds media items with corrupted watchers data that need re-sync.
 *
 * Covers two integrity issues:
 * - Missing total_watchers (0/NULL) despite Trakt engagement.
 * - Missing live watchers_count (0) despite historical total_watchers.
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class WatchersIntegrityQuery {
  private readonly logger = new Logger(WatchersIntegrityQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Finds items with corrupted total_watchers data.
   * Items where total_watchers = 0 (or null) but have Trakt votes indicate API failure during sync.
   */
  async findMissingWatchers(options: {
    type?: MediaType;
    limit: number;
    minVotes: number;
  }): Promise<CorruptedWatchersItem[]> {
    return withDbError(
      'find items with missing watchers',
      this.logger,
      async () => {
        const conditions = buildMissingWatchersConditions({
          type: options.type,
          minVotes: options.minVotes,
        });

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
          })
          .from(schema.mediaItems)
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(and(...conditions))
          .orderBy(desc(schema.mediaItems.voteCountTrakt))
          .limit(options.limit);

        return rows
          .filter((r) => r.tmdbId !== null && r.voteCountTrakt !== null)
          .map((r) => ({
            id: r.id,
            tmdbId: r.tmdbId!,
            type: r.type,
            voteCountTrakt: r.voteCountTrakt!,
          }));
      },
      { type: options.type, limit: options.limit, minVotes: options.minVotes },
    );
  }

  /**
   * Finds items with corrupted watchers_count (live watchers).
   * Items where watchers_count = 0 but total_watchers > minTotalWatchers.
   */
  async findCorruptedWatchersCount(options: {
    type?: MediaType;
    limit: number;
    minTotalWatchers: number;
  }): Promise<CorruptedWatchersItem[]> {
    return withDbError(
      'find items with corrupted watchers count',
      this.logger,
      async () => {
        const conditions = buildCorruptedWatchersCountConditions({
          type: options.type,
          minTotalWatchers: options.minTotalWatchers,
        });

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
            voteCountTrakt: schema.mediaItems.voteCountTrakt,
          })
          .from(schema.mediaItems)
          .innerJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(and(...conditions))
          .orderBy(desc(schema.mediaStats.totalWatchers))
          .limit(options.limit);

        return rows
          .filter((r) => r.tmdbId !== null)
          .map((r) => ({
            id: r.id,
            tmdbId: r.tmdbId!,
            type: r.type,
            voteCountTrakt: r.voteCountTrakt ?? 0,
          }));
      },
      { type: options.type, limit: options.limit, minTotalWatchers: options.minTotalWatchers },
    );
  }
}
