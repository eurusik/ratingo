/**
 * Catalog Domain Errors
 *
 * Domain-specific errors for catalog operations.
 * These are NOT HTTP exceptions - they are domain errors that
 * get mapped to HTTP responses in the presentation layer.
 */

/**
 * Base class for catalog domain errors.
 */
export abstract class CatalogDomainError extends Error {
  abstract readonly code: string;
}

/**
 * Thrown when a movie is not found by slug.
 */
export class MovieNotFoundError extends CatalogDomainError {
  readonly code = 'MOVIE_NOT_FOUND';
  readonly slug: string;

  constructor(slug: string) {
    super(`Movie with slug "${slug}" not found`);
    this.name = 'MovieNotFoundError';
    this.slug = slug;
  }
}

/**
 * Thrown when a show is not found by slug.
 */
export class ShowNotFoundError extends CatalogDomainError {
  readonly code = 'SHOW_NOT_FOUND';
  readonly slug: string;

  constructor(slug: string) {
    super(`Show with slug "${slug}" not found`);
    this.name = 'ShowNotFoundError';
    this.slug = slug;
  }
}
