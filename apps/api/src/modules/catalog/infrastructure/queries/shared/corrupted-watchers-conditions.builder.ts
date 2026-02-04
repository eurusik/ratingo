import { eq, gte, isNull, sql, type SQL } from 'drizzle-orm';

import { MediaType } from '@/common/enums/media-type.enum';
import * as schema from '@/database/schema';

/**
 * Options for building missing watchers conditions.
 */
export interface MissingWatchersConditionsOptions {
  /** Filter by media type (movie/show) */
  type?: MediaType;
  /** Minimum Trakt vote count to include item */
  minVotes: number;
}

/**
 * Options for building corrupted watchers count conditions.
 */
export interface CorruptedWatchersCountConditionsOptions {
  /** Filter by media type (movie/show) */
  type?: MediaType;
  /** Minimum total watchers threshold to identify corrupted data */
  minTotalWatchers: number;
}

/**
 * Builds WHERE conditions for finding items with missing total_watchers data.
 *
 * Identifies items where:
 * - total_watchers = 0 or NULL (missing data)
 * - BUT has Trakt votes >= minVotes (indicating the item should have watchers)
 * - Not soft-deleted
 *
 * This indicates an API failure during sync - the item has Trakt engagement
 * but we failed to fetch watchers data.
 *
 * @param options - Filtering options
 * @returns Array of SQL conditions for WHERE clause
 *
 * @example
 * ```typescript
 * const conditions = buildMissingWatchersConditions({
 *   type: MediaType.MOVIE,
 *   minVotes: 100,
 * });
 * // Use in: .where(and(...conditions))
 * ```
 */
export function buildMissingWatchersConditions(options: MissingWatchersConditionsOptions): SQL[] {
  const { type, minVotes } = options;

  const conditions: SQL[] = [
    isNull(schema.mediaItems.deletedAt),
    gte(schema.mediaItems.voteCountTrakt, minVotes),
    sql`(${schema.mediaStats.totalWatchers} IS NULL OR ${schema.mediaStats.totalWatchers} = 0)`,
  ];

  if (type) {
    conditions.push(eq(schema.mediaItems.type, type));
  }

  return conditions;
}

/**
 * Builds WHERE conditions for finding items with corrupted watchers_count.
 *
 * Identifies items where:
 * - watchers_count = 0 (no live watchers data)
 * - BUT total_watchers >= minTotalWatchers (item has historical engagement)
 * - Not soft-deleted
 *
 * This pattern suggests the live watchers API failed but historical data exists,
 * meaning the item should have some live watchers based on its popularity.
 *
 * @param options - Filtering options
 * @returns Array of SQL conditions for WHERE clause
 *
 * @example
 * ```typescript
 * const conditions = buildCorruptedWatchersCountConditions({
 *   type: MediaType.SHOW,
 *   minTotalWatchers: 1000,
 * });
 * // Use in: .where(and(...conditions))
 * ```
 */
export function buildCorruptedWatchersCountConditions(
  options: CorruptedWatchersCountConditionsOptions,
): SQL[] {
  const { type, minTotalWatchers } = options;

  const conditions: SQL[] = [
    isNull(schema.mediaItems.deletedAt),
    eq(schema.mediaStats.watchersCount, 0),
    gte(schema.mediaStats.totalWatchers, minTotalWatchers),
  ];

  if (type) {
    conditions.push(eq(schema.mediaItems.type, type));
  }

  return conditions;
}
