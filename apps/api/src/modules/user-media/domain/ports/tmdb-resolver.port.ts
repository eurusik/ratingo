/**
 * Port for resolving TMDB identifiers from external source identifiers.
 *
 * Owned by user-media domain. Infrastructure adapters implement this
 * without coupling the domain to any HTTP client.
 *
 * Pure domain interface — zero NestJS/Drizzle dependencies.
 */
export interface ITmdbResolverPort {
  /**
   * Finds a TMDB item by IMDB ID using the TMDB Find API.
   * IMDB IDs are globally unique so the result is unambiguous.
   *
   * Returns null if no match found in TMDB.
   */
  findByImdbId(imdbId: string): Promise<{ tmdbId: number; type: 'movie' | 'show' } | null>;

  /**
   * Checks whether a TMDB item exists for the given ID and type.
   * Used as fallback when only a TMDB ID is available (no IMDB ID).
   *
   * Returns true if the item exists (HTTP 200), false on HTTP 404.
   */
  checkExists(tmdbId: number, type: 'movie' | 'show'): Promise<boolean>;
}

export const TMDB_RESOLVER = Symbol('TMDB_RESOLVER');
