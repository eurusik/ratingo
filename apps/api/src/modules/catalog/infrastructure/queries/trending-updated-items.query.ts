import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, gt, gte, isNull, isNotNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type MediaSyncItem } from '../../domain/repositories/media.repository.interface';

import { toMediaIdItems } from './shared';

/**
 * Retrieves media items updated by trending sync since a given date.
 *
 * Used by stats sync to get items that were recently synced.
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class TrendingUpdatedItemsQuery {
  private readonly logger = new Logger(TrendingUpdatedItemsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(options: { since?: Date; limit: number }): Promise<MediaSyncItem[]> {
    return withDbError(
      'find trending updated items',
      this.logger,
      async () => {
        const conditions = [
          isNull(schema.mediaItems.deletedAt),
          gt(schema.mediaItems.trendingScore, 0),
          isNotNull(schema.mediaItems.tmdbId),
        ];

        if (options.since) {
          conditions.push(gte(schema.mediaItems.trendingUpdatedAt, options.since));
        }

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
          })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(desc(schema.mediaItems.trendingScore))
          .limit(options.limit);

        return toMediaIdItems(rows);
      },
      { since: options.since?.toISOString(), limit: options.limit },
    );
  }
}
