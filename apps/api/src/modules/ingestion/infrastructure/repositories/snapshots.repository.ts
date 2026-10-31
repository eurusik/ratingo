import { Injectable, Inject, Logger } from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type ISnapshotsRepository,
  type SnapshotUpsertData,
} from '../../domain/repositories/snapshots.repository.interface';

/**
 * Drizzle implementation of ISnapshotsRepository.
 */
@Injectable()
export class SnapshotsRepository implements ISnapshotsRepository {
  private readonly logger = new Logger(SnapshotsRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * @inheritdoc
   */
  async bulkUpsertSnapshots(data: SnapshotUpsertData[]): Promise<void> {
    if (data.length === 0) return;
    return withDbError(
      'bulk upsert snapshots',
      this.logger,
      () => {
        const values = data.map((d) => ({
          mediaItemId: d.mediaItemId,
          snapshotDate: d.snapshotDate,
          totalWatchers: d.totalWatchers,
          region: d.region,
        }));

        return this.db
          .insert(schema.mediaWatchersSnapshots)
          .values(values)
          .onConflictDoUpdate({
            target: [
              schema.mediaWatchersSnapshots.mediaItemId,
              schema.mediaWatchersSnapshots.snapshotDate,
              schema.mediaWatchersSnapshots.region,
            ],
            set: {
              totalWatchers: sql`excluded.total_watchers`,
            },
          })
          .then(() => undefined);
      },
      { count: data.length },
    );
  }
}
