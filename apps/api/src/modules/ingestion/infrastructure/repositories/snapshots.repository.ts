import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  ISnapshotsRepository,
  MediaItemForSnapshot,
  SnapshotUpsertData,
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
}
