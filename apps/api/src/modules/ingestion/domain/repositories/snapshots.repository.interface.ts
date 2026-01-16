import { type MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Minimal media info needed for snapshot sync.
 */
export interface MediaItemForSnapshot {
  tmdbId: number;
  type: MediaType;
}

/**
 * Snapshot data to upsert.
 */
export interface SnapshotUpsertData {
  mediaItemId: string;
  snapshotDate: Date;
  totalWatchers: number;
  region: string;
}

/**
 * Abstract interface for Snapshots storage.
 * Decouples the application layer from Drizzle/Postgres.
 */
export interface ISnapshotsRepository {
  /**
   * Retrieves minimal media info needed for snapshot sync.
   *
   * @param {string} mediaItemId - The ID of the media item
   * @returns {Promise<MediaItemForSnapshot | null>} Media info or null if not found
   */
  findMediaItemForSnapshot(mediaItemId: string): Promise<MediaItemForSnapshot | null>;

  /**
   * Upserts a watcher snapshot.
   * Idempotent for the same (mediaItemId, snapshotDate, region) combination.
   *
   * @param {SnapshotUpsertData} data - Snapshot data to upsert
   * @returns {Promise<void>} Nothing
   */
  upsertSnapshot(data: SnapshotUpsertData): Promise<void>;

  /**
   * Bulk upserts watcher snapshots using a single INSERT statement.
   * More efficient than multiple individual upserts.
   *
   * @param {SnapshotUpsertData[]} data - Array of snapshot data to upsert
   * @returns {Promise<void>} Nothing
   */
  bulkUpsertSnapshots(data: SnapshotUpsertData[]): Promise<void>;
}

/**
 * Injection token for the Snapshots repository.
 */
export const SNAPSHOTS_REPOSITORY = Symbol('SNAPSHOTS_REPOSITORY');
