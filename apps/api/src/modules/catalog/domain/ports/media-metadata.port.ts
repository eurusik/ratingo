import { type MediaType } from '@/common/enums/media-type.enum';

/**
 * Minimal metadata returned by getMovie/getShow.
 * Only fields that catalog import actually needs.
 */
export interface MediaMetadata {
  title: string | null;
}

/**
 * Search result item from external metadata provider.
 */
export interface MetadataSearchResult {
  externalIds: { tmdbId: number };
  type: MediaType;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  posterPath: string | null;
  rating: number;
}

/**
 * Port for fetching media metadata from an external provider.
 * Decouples application layer from concrete TMDB infrastructure.
 */
export interface IMediaMetadataPort {
  /** Fetches movie metadata by TMDB ID. Returns null if not found. */
  getMovie(tmdbId: number): Promise<MediaMetadata | null>;

  /** Fetches show metadata by TMDB ID. Returns null if not found. */
  getShow(tmdbId: number): Promise<MediaMetadata | null>;

  /** Performs multi-search (movies & shows). */
  searchMulti(query: string, page?: number): Promise<MetadataSearchResult[]>;
}

/**
 * Injection token for the media metadata port.
 */
export const MEDIA_METADATA_PORT = Symbol('MEDIA_METADATA_PORT');
