import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Base row with potentially nullable TMDB ID from database query.
 */
interface BaseRow {
  id: string;
  tmdbId: number | null;
  type: MediaType;
}

/**
 * Row with validated non-null TMDB ID.
 */
interface ValidRow {
  id: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Minimal media ID item with required fields.
 */
export interface MediaIdItem {
  id: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Filters rows to only include those with non-null TMDB IDs.
 *
 * Used when querying media items that may have null TMDB IDs due to
 * incomplete ingestion or data integrity issues.
 *
 * @param rows - Array of rows with potentially null TMDB IDs
 * @returns Array of rows with guaranteed non-null TMDB IDs
 *
 * @example
 * ```typescript
 * const rows = await db.select({ id, tmdbId, type }).from(mediaItems);
 * const valid = filterValidTmdbIds(rows);
 * // valid[0].tmdbId is guaranteed to be number, not null
 * ```
 */
export function filterValidTmdbIds<T extends BaseRow>(rows: T[]): (T & ValidRow)[] {
  return rows.filter((r): r is T & ValidRow => r.tmdbId !== null);
}

/**
 * Maps a database row to a minimal MediaIdItem.
 *
 * Extracts only the essential fields needed for media identification:
 * id, tmdbId, and type. Used when additional row fields should be discarded.
 *
 * @param row - Row with id, tmdbId, and type fields
 * @returns Minimal media ID item
 *
 * @example
 * ```typescript
 * const rows = await db.select({ id, tmdbId, type, voteCount }).from(mediaItems);
 * const valid = filterValidTmdbIds(rows);
 * const items = valid.map(mapToMediaIdItem);
 * // items contain only id, tmdbId, type (voteCount discarded)
 * ```
 */
export function mapToMediaIdItem(row: {
  id: string;
  tmdbId: number;
  type: MediaType;
}): MediaIdItem {
  return {
    id: row.id,
    tmdbId: row.tmdbId,
    type: row.type,
  };
}

/**
 * Combined filter and map operation for media items with TMDB IDs.
 *
 * Convenience function that combines filterValidTmdbIds and mapToMediaIdItem
 * into a single operation. Filters out rows with null TMDB IDs and maps
 * to minimal MediaIdItem objects.
 *
 * @param rows - Array of rows with potentially null TMDB IDs
 * @returns Array of minimal MediaIdItem objects with valid TMDB IDs
 *
 * @example
 * ```typescript
 * const rows = await db.select({ id, tmdbId, type }).from(mediaItems);
 * return toMediaIdItems(rows);
 * ```
 */
export function toMediaIdItems<T extends { id: string; tmdbId: number | null; type: MediaType }>(
  rows: T[],
): MediaIdItem[] {
  return filterValidTmdbIds(rows).map(mapToMediaIdItem);
}
