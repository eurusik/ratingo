import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { HeroMediaItem, LocalSearchResult } from '../models/hero-media.model';

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
   * @returns {Promise<HeroMediaItem[]>} Hero items
   */
  findHero(limit: number, type?: MediaType): Promise<HeroMediaItem[]>;

  /**
   * Searches for media items using full-text search.
   *
   * @param {string} query - Search string
   * @param {number} limit - Max items
   * @returns {Promise<LocalSearchResult[]>} Search results
   */
  search(query: string, limit: number): Promise<LocalSearchResult[]>;

  /**
   * Retrieves media items updated by trending sync since a given date.
   * Used by stats sync to get items that were recently synced.
   *
   * @param {object} options - Query options
   * @param {Date} options.since - Only items updated after this date
   * @param {number} options.limit - Max items to return
   * @returns {Promise<TrendingUpdatedItem[]>} Items with tmdbId and type
   */
  findTrendingUpdatedItems(options: {
    since?: Date;
    limit: number;
  }): Promise<TrendingUpdatedItem[]>;

  /**
   * Retrieves IDs of active media items for snapshots sync with cursor pagination.
   *
   * @param {object} options - Pagination options
   * @param {string} options.cursor - Last processed ID (exclusive)
   * @param {number} options.limit - Number of IDs to fetch
   * @returns {Promise<string[]>} List of media item IDs
   */
  findIdsForSnapshots(options: { cursor?: string; limit: number }): Promise<string[]>;
}

/**
 * Item returned by findTrendingUpdatedItems.
 */
export interface TrendingUpdatedItem {
  id: string;
  tmdbId: number;
  type: MediaType;
}

/**
 * Injection token for the Media repository.
 */
export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');
