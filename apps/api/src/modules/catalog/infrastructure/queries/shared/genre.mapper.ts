import type { GenreInfo } from '../../../domain/types/common.types';

/**
 * Raw row type from genres table query.
 */
export interface GenreQueryRow {
  id: string;
  name: string;
  slug: string;
}

/**
 * Raw row type from batch query with mediaItemId.
 */
export interface GenreWithMediaRow extends GenreQueryRow {
  mediaItemId: string;
}

/**
 * Maps a database row to domain GenreInfo.
 */
export function mapGenreRow(row: GenreQueryRow): GenreInfo {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
  };
}

/**
 * Groups genre rows by mediaItemId for batch queries.
 * Returns a Map where keys are mediaItemIds and values are arrays of GenreInfo.
 */
export function groupGenresByMediaId(rows: GenreWithMediaRow[]): Map<string, GenreInfo[]> {
  const genresMap = new Map<string, GenreInfo[]>();

  for (const row of rows) {
    let genres = genresMap.get(row.mediaItemId);
    if (!genres) {
      genres = [];
      genresMap.set(row.mediaItemId, genres);
    }
    genres.push(mapGenreRow(row));
  }

  return genresMap;
}
