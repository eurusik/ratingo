import { CatalogListQueryDto } from '../dtos/catalog-list-query.dto';

/**
 * Normalized query with parsed genres array.
 */
export type NormalizedQuery<T extends CatalogListQueryDto> = T & { genres?: string[] };

/**
 * Normalizes catalog list query by parsing comma-separated genres into an array.
 *
 * @param {T} query - Incoming query DTO with genres as comma-separated string
 * @returns {NormalizedQuery<T>} Query with genres parsed into string array
 */
export function normalizeListQuery<T extends CatalogListQueryDto>(query: T): NormalizedQuery<T> {
  const genres =
    query.genres
      ?.split(',')
      .map((g) => g.trim())
      .filter((g) => g.length > 0) || undefined;

  return { ...query, genres } as NormalizedQuery<T>;
}
