/**
 * Port for looking up internal media item IDs from external identifiers.
 *
 * Owned by user-media domain. Infrastructure adapters implement this
 * without coupling the domain to any ORM or HTTP client.
 */
export interface IMediaLookupPort {
  /**
   * Finds media items matching any of the given IMDB IDs.
   * IMDB IDs are globally unique (not per type), so results are unambiguous.
   */
  findManyByImdbIds(
    imdbIds: string[],
  ): Promise<Array<{ id: string; imdbId: string; type: string }>>;

  /**
   * Finds media items matching any of the given TMDB IDs.
   * TMDB IDs are unique per type (movie vs show), so the same integer can
   * appear in both movies and shows. Callers must handle ambiguous results.
   */
  findManyByTmdbIds(
    tmdbIds: number[],
  ): Promise<Array<{ id: string; tmdbId: number; type: string }>>;
}
