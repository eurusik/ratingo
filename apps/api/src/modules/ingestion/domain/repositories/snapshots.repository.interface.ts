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
   * Bulk upserts watcher snapshots using a single INSERT statement.
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
