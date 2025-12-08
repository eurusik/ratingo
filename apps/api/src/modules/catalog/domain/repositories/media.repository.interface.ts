import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';

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
}

export const MEDIA_REPOSITORY = 'MEDIA_REPOSITORY';
