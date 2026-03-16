import {
  type ImportPendingFailure,
  type ImportPendingItemStatus,
} from '../constants/import-pending.constants';

/**
 * Entity representing a single pending import item within a batch.
 *
 * Tracks the full lifecycle from initial pending state through TMDB resolution,
 * ingestion, and final linking to a user_media_state record.
 *
 * userId is NOT stored here — reachable via batchId → batch.userId.
 *
 * Pure domain interface — zero NestJS/Drizzle dependencies.
 */
export interface ImportPendingItem {
  id: string;
  batchId: string;
  /** IMDB identifier from the source CSV (e.g. "tt1234567"). */
  imdbId: string | null;
  /** TMDB integer identifier from the source CSV. Unique per type, not globally. */
  tmdbId: number | null;
  /** Resolved TMDB ID after lookup via TMDB Find API. */
  resolvedTmdbId: number | null;
  /** Resolved media type ('movie' | 'show') after TMDB lookup. */
  mediaType: 'movie' | 'show' | null;
  /** Human-readable title from source (for logging/reporting only). */
  title: string | null;
  /** Rating on internal 1-100 scale, or null if no rating. */
  rating: number | null;
  /** User's intended watch state from the import source. */
  state: 'completed' | 'planned';
  status: ImportPendingItemStatus;
  failureReason: ImportPendingFailure | null;
  /** Catalog media_item_id once the item has been ingested and linked. */
  mediaItemId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
