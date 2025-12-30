import { DatabaseTransaction } from '../types/transaction.type';

/**
 * Genre data for syncing.
 */
export interface GenreData {
  tmdbId: number;
  name: string;
  slug: string;
}

/**
 * Abstract interface for Genre storage operations.
 */
export interface IGenreRepository {
  /**
   * Syncs genres for a media item within a transaction.
   * Ensures genres exist in registry and links them to the media item.
   *
   * @param {DatabaseTransaction} tx - Transaction handle
   * @param {string} mediaId - Media item id
   * @param {GenreData[]} genres - Genres payload
   * @returns {Promise<void>} Nothing
   */
  syncGenres(tx: DatabaseTransaction, mediaId: string, genres: GenreData[]): Promise<void>;
}

/**
 * Injection token for the Genre repository.
 */
export const GENRE_REPOSITORY = Symbol('GENRE_REPOSITORY');
