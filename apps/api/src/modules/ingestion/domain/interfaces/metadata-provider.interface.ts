import { NormalizedMedia } from '../models/normalized-media.model';

/**
 * Port (Interface) for any external metadata provider.
 * 
 * Whether it's TMDB, Trakt, or OMDb - they all must satisfy this contract.
 * This allows us to switch or aggregate providers without changing business logic.
 */
export interface IMetadataProvider {
  /**
   * Unique identifier of the provider (e.g. 'tmdb', 'trakt')
   */
  readonly providerName: string;

  /**
   * Fetches details for a movie by its external ID (usually TMDB ID for now).
   * @param id - The TMDB ID of the movie
   */
  getMovie(id: number): Promise<NormalizedMedia | null>;

  /**
   * Fetches details for a TV show.
   * @param id - The TMDB ID of the show
   */
  getShow(id: number): Promise<NormalizedMedia | null>;

  /**
   * Fetches currently trending items.
   * @returns List of TMDB IDs and basic info if available
   */
  getTrending(page?: number): Promise<Array<{ tmdbId: number; type: 'movie' | 'show' }>>;
}
