import type { NewEpisodeItem } from '../../../domain/repositories/show.repository.interface';

/**
 * Raw row from the new episodes SQL query.
 * Uses snake_case column names as returned by PostgreSQL.
 *
 * Note: Index signature required by Drizzle's execute<T> constraint.
 */
export interface NewEpisodeRow extends Record<string, unknown> {
  media_item_id: string;
  slug: string;
  title: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  air_date: Date;
}

/**
 * Maps a single raw database row to NewEpisodeItem DTO.
 * Handles fallback for missing episode title.
 *
 * @param row - Raw database row with snake_case columns
 * @returns Mapped NewEpisodeItem with camelCase properties
 */
export function mapNewEpisodeRow(row: NewEpisodeRow): NewEpisodeItem {
  return {
    mediaItemId: row.media_item_id,
    slug: row.slug,
    title: row.title,
    posterPath: row.poster_path,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    episodeTitle: row.episode_title ?? `Episode ${row.episode_number}`,
    airDate: row.air_date,
  };
}

/**
 * Maps multiple raw database rows to NewEpisodeItem array.
 *
 * @param rows - Array of raw database rows
 * @returns Array of mapped NewEpisodeItem DTOs
 */
export function mapNewEpisodeRows(rows: NewEpisodeRow[]): NewEpisodeItem[] {
  return rows.map(mapNewEpisodeRow);
}
