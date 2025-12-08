/**
 * Genre data for syncing.
 */
export interface GenreData {
  tmdbId: number;
  name: string;
  slug: string;
}

/**
 * Transaction type for repository operations.
 */
export type DbTransaction = any; // Will be properly typed by implementation

/**
 * Abstract interface for Genre storage operations.
 */
export interface IGenreRepository {
  /**
   * Syncs genres for a media item within a transaction.
   * Ensures genres exist in registry and links them to the media item.
   */
  syncGenres(tx: DbTransaction, mediaId: string, genres: GenreData[]): Promise<void>;
}

export const GENRE_REPOSITORY = Symbol('GENRE_REPOSITORY');
