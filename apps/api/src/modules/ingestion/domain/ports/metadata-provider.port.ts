import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type NormalizedMedia } from '../models/normalized-media.model';

/**
 * Injection token for metadata provider port.
 */
export const METADATA_PROVIDER_PORT = Symbol('METADATA_PROVIDER_PORT');

/**
 * Port (Interface) for any external metadata provider.
 *
 * Whether it's TMDB, Trakt, or OMDb - they all must satisfy this contract.
 * This allows us to switch or aggregate providers without changing business logic.
 */
export interface MetadataProviderPort {
  /**
   * Unique identifier of the provider (e.g. 'tmdb', 'trakt')
   */
  readonly providerName: string;

  /**
   * Fetches details for a movie by its external ID (usually TMDB ID for now).
   * @param {number} id - The TMDB ID of the movie
   * @returns {Promise<NormalizedMedia | null>} Movie details or null
   */
  getMovie(id: number): Promise<NormalizedMedia | null>;

  /**
   * Fetches details for a TV show.
   * @param {number} id - The TMDB ID of the show
   * @returns {Promise<NormalizedMedia | null>} Show details or null
   */
  getShow(id: number): Promise<NormalizedMedia | null>;

  /**
   * Fetches currently trending items.
   * @param {number} page - Page number (1-based)
   * @param {MediaType} type - Optional filter by media type
   * @returns {Promise<Array<{ tmdbId: number; type: MediaType }>>} List of TMDB IDs
   */
  getTrending(page?: number, type?: MediaType): Promise<Array<{ tmdbId: number; type: MediaType }>>;
}
