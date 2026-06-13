import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, desc } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type MediaSyncItem } from '../../domain/repositories/media.repository.interface';

import {
  toMediaIdItems,
  buildHeroCandidatesConditions,
  buildHeroCandidatesEvaluationConditions,
} from './shared';

/**
 * Finds homepage candidates with stale stats that need refresh.
 *
 * Targets items that may appear in Hero or Watching-Now sections.
 * Uses configurable quality threshold to cover both (hero@60, watching-now@50).
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class HeroCandidatesStatsQuery {
  private readonly logger = new Logger(HeroCandidatesStatsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(options: {
    staleThresholdHours: number;
    limit: number;
    /** Minimum quality score (use 50 to cover both hero and watching-now) */
    minQualityScore?: number;
  }): Promise<MediaSyncItem[]> {
    return withDbError(
      'find homepage candidates for stats refresh',
      this.logger,
      async () => {
        const conditions = buildHeroCandidatesConditions({
          staleThresholdHours: options.staleThresholdHours,
          minQualityScore: options.minQualityScore,
        });

        const evaluationConditions = buildHeroCandidatesEvaluationConditions();

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
              ...evaluationConditions,
            ),
          )
          .innerJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
          .leftJoin(schema.shows, eq(schema.mediaItems.id, schema.shows.mediaItemId))
          .where(and(...conditions))
          .orderBy(desc(schema.mediaStats.watchersCount), desc(schema.mediaStats.ratingoScore))
          .limit(options.limit);

        return toMediaIdItems(rows);
      },
      {
        staleThresholdHours: options.staleThresholdHours,
        limit: options.limit,
        minQualityScore: options.minQualityScore,
      },
    );
  }
}
