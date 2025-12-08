import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';

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
   * Creates or updates a media item (Movie/Show) and its related entities 
   * (genres, specific details) in a transactional way.
   * 
   * Strategy: Match by TMDB ID.
   */
  upsert(media: NormalizedMedia): Promise<void>;

  /**
   * Retrieves a media item by its external TMDB ID.
   */
  findByTmdbId(tmdbId: number): Promise<{ id: string; slug: string } | null>;

  /**
   * Retrieves media data needed for score calculation.
   */
  findByIdForScoring(id: string): Promise<MediaScoreData | null>;

  /**
   * Batch: Retrieves multiple media items by TMDB IDs.
   * Returns a map of tmdbId -> { id, tmdbId }
   */
  findManyByTmdbIds(tmdbIds: number[]): Promise<MediaWithTmdbId[]>;

  /**
   * Batch: Retrieves score data for multiple media items by their IDs.
   * Returns array with tmdbId included for mapping.
   */
  findManyForScoring(ids: string[]): Promise<MediaScoreDataWithTmdbId[]>;
}

export const MEDIA_REPOSITORY = 'MEDIA_REPOSITORY';
