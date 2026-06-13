import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type SnapshotCandidate } from '../../domain/repositories/media.repository.interface';

import { toMediaIdItems, buildSnapshotCandidateConditions } from './shared';

/**
 * Retrieves ELIGIBLE media items for snapshots sync with cursor pagination.
 *
 * Filters to items that pass Policy Engine in TRENDING context.
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class SnapshotCandidatesQuery {
  private readonly logger = new Logger(SnapshotCandidatesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(options: { cursor?: string; limit: number }): Promise<SnapshotCandidate[]> {
    return withDbError(
      'find snapshot candidates',
      this.logger,
      async () => {
        // Get active policy version
        const activePolicy = await this.db
          .select({ version: schema.catalogPolicies.version })
          .from(schema.catalogPolicies)
          .where(eq(schema.catalogPolicies.isActive, true))
          .limit(1);

        if (!activePolicy.length) {
          this.logger.warn('No active policy found for snapshot candidates');
          return [];
        }

        const conditions = buildSnapshotCandidateConditions({
          policyVersion: activePolicy[0].version,
          cursor: options.cursor,
        });

        const rows = await this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
            type: schema.mediaItems.type,
          })
          .from(schema.mediaItems)
          .innerJoin(
            schema.mediaCatalogEvaluations,
            eq(schema.mediaCatalogEvaluations.mediaItemId, schema.mediaItems.id),
          )
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(options.limit);

        return toMediaIdItems(rows);
      },
      { cursor: options.cursor, limit: options.limit },
    );
  }
}
