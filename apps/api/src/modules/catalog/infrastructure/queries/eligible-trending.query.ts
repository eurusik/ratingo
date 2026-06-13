import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, sql, and, isNull, isNotNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import { type MediaSyncItem } from '../../domain/repositories/media.repository.interface';

import { toMediaIdItems } from './shared';

/**
 * Finds ELIGIBLE items for trending context that need watchers sync.
 *
 * Only returns items with watchers_count = 0 or NULL (never synced or stale).
 * Used to backfill watchers data for items not in Trakt trending top-100.
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class EligibleTrendingQuery {
  private readonly logger = new Logger(EligibleTrendingQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(options: { limit: number; offset: number }): Promise<MediaSyncItem[]> {
    return withDbError(
      'find eligible items for trending',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
          })
          .from(schema.mediaItems)
          .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
          .innerJoin(
            schema.mediaCatalogEvaluations,
            and(
              eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
              eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
              eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
              eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
            ),
          )
          .leftJoin(schema.mediaStats, eq(schema.mediaStats.mediaItemId, schema.mediaItems.id))
          .where(
            and(
              isNull(schema.mediaItems.deletedAt),
              isNotNull(schema.mediaItems.tmdbId),
              // Only items that need sync (no watchers data yet)
              sql`(${schema.mediaStats.watchersCount} IS NULL OR ${schema.mediaStats.watchersCount} = 0)`,
            ),
          )
          .orderBy(schema.mediaItems.id)
          .limit(options.limit)
          .offset(options.offset);

        return toMediaIdItems(rows);
      },
      { limit: options.limit, offset: options.offset },
    );
  }
}
