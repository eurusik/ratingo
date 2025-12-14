import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

/**
 * Data needed for score calculation.
 */
export interface MediaScoreData {
  id: string;
  popularity: number;
  releaseDate: Date | null;
  ratingImdb: number | null;
  ratingTrakt: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;
  voteCountImdb: number | null;
  voteCountTrakt: number | null;
}

/**
 * Media item with TMDB ID mapping.
 */
export interface MediaWithTmdbId {
  id: string;
  tmdbId: number;
}

/**
 * Score data with TMDB ID for batch operations.
 */
export interface MediaScoreDataWithTmdbId extends MediaScoreData {
  tmdbId: number;
}

/**
 * Abstract interface for Media storage.
 * Decouples the business logic from Drizzle/Postgres.
 */
export interface IMediaRepository {
  /**
   * Creates a minimal stub media item (media_items only) used to start ingestion.
   * Should not fail if the item already exists – returns existing id/slug in that case.
   *
   * @param {{ tmdbId: number; type: MediaType; title: string; slug: string; ingestionStatus: IngestionStatus }} payload - Stub payload
   * @returns {Promise<{ id: string; slug: string }>} Created or existing stub
   */
  upsertStub(payload: {
    tmdbId: number;
    type: MediaType;
    title: string;
    slug: string;
    ingestionStatus: IngestionStatus;
  }): Promise<{ id: string; slug: string }>;

  /**
   * Creates or updates a media item (Movie/Show) and its related entities
   * (genres, specific details) in a transactional way.
   *
   * Strategy: Match by TMDB ID.
   *
   * @param {NormalizedMedia} media - Normalized media payload
   * @returns {Promise<void>} Nothing
   */
  upsert(media: NormalizedMedia): Promise<void>;

  /**
   * Retrieves a media item by its external TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<{ id: string; slug: string; type: MediaType; ingestionStatus: IngestionStatus } | null>} Mapping or null
   */
  findByTmdbId(tmdbId: number): Promise<{
    id: string;
    slug: string;
    type: MediaType;
    ingestionStatus: IngestionStatus;
  } | null>;

  /**
   * Updates ingestion status by TMDB ID (no-op if not found).
   *
   * @param {number} tmdbId - TMDB ID
   * @param {IngestionStatus} status - New status
   * @returns {Promise<void>} Nothing
   */
  updateIngestionStatus(tmdbId: number, status: IngestionStatus): Promise<void>;

  /**
   * Retrieves media data needed for score calculation.
   *
   * @param {string} id - Media item id
   * @returns {Promise<MediaScoreData | null>} Score data or null
   */
  findByIdForScoring(id: string): Promise<MediaScoreData | null>;

  /**
   * Batch: Retrieves multiple media items by TMDB IDs.
   * Returns a map of tmdbId -> { id, tmdbId }
   *
   * @param {number[]} tmdbIds - TMDB IDs
   * @returns {Promise<MediaWithTmdbId[]>} Mappings list
   */
  findManyByTmdbIds(tmdbIds: number[]): Promise<MediaWithTmdbId[]>;

  /**
   * Batch: Retrieves score data for multiple media items by their IDs.
   * Batch: Retrieves score data for multiple media items in a single query.
   *
   * @param {string[]} ids - Media item ids
   * @returns {Promise<MediaScoreDataWithTmdbId[]>} Score data list
   */
  findManyForScoring(ids: string[]): Promise<MediaScoreDataWithTmdbId[]>;

  /**
   * Retrieves top media items for the Hero block.
   * Criteria: Released, has poster/backdrop, sorted by popularity.
   *
   * @param {number} limit - Max items
   * @param {MediaType} type - Optional media type filter
   * @returns {Promise<any[]>} Hero items
   */
  findHero(limit: number, type?: MediaType): Promise<any[]>;

  /**
   * Searches for media items using full-text search.
   *
   * @param {string} query - Search string
   * @param {number} limit - Max items
   * @returns {Promise<any[]>} Search results
   */
  search(query: string, limit: number): Promise<any[]>;
}

/**
 * Injection token for the Media repository.
 */
export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');
