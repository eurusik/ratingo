import { Injectable, Inject } from '@nestjs/common';

import { eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type ISnapshotsRepository,
  type MediaItemForSnapshot,
  type SnapshotUpsertData,
} from '../../domain/repositories/snapshots.repository.interface';

/**
 * Drizzle implementation of ISnapshotsRepository.
 */
@Injectable()
export class SnapshotsRepository implements ISnapshotsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * @inheritdoc
   */
  async findMediaItemForSnapshot(mediaItemId: string): Promise<MediaItemForSnapshot | null> {
    const items = await this.db
      .select({
        tmdbId: schema.mediaItems.tmdbId,
        type: schema.mediaItems.type,
      })
      .from(schema.mediaItems)
      .where(eq(schema.mediaItems.id, mediaItemId))
      .limit(1);

    if (!items.length) {
      return null;
    }

    return items[0];
  }

  /**
   * @inheritdoc
   */
  async upsertSnapshot(data: SnapshotUpsertData): Promise<void> {
    await this.db
      .insert(schema.mediaWatchersSnapshots)
      .values({
        mediaItemId: data.mediaItemId,
        snapshotDate: data.snapshotDate,
        totalWatchers: data.totalWatchers,
        region: data.region,
      })
      .onConflictDoUpdate({
        target: [
          schema.mediaWatchersSnapshots.mediaItemId,
          schema.mediaWatchersSnapshots.snapshotDate,
          schema.mediaWatchersSnapshots.region,
        ],
        set: {
          totalWatchers: data.totalWatchers,
        },
      });
  }

  /**
   * @inheritdoc
   */
  async bulkUpsertSnapshots(data: SnapshotUpsertData[]): Promise<void> {
    if (data.length === 0) return;

    const values = data.map((d) => ({
      mediaItemId: d.mediaItemId,
      snapshotDate: d.snapshotDate,
      totalWatchers: d.totalWatchers,
      region: d.region,
    }));

    await this.db
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
      });
  }
}
