import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, gt, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';

/**
 * Retrieves IDs of active media items for snapshots sync with cursor pagination.
 *
 * @throws {DatabaseException} When the database query fails
 */
@Injectable()
export class SnapshotIdsQuery {
  private readonly logger = new Logger(SnapshotIdsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(options: { cursor?: string; limit: number }): Promise<string[]> {
    return withDbError(
      'find IDs for snapshots',
      this.logger,
      async () => {
        const conditions = [isNull(schema.mediaItems.deletedAt)];

        if (options.cursor) {
          conditions.push(gt(schema.mediaItems.id, options.cursor));
        }

        const rows = await this.db
          .select({ id: schema.mediaItems.id })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(options.limit);

        return rows.map((r) => r.id);
      },
      { cursor: options.cursor, limit: options.limit },
    );
  }
}
