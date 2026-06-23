/**
 * Person Domain Errors
 *
 * Pure domain errors mapped to HTTP responses in the presentation layer.
 */

/**
 * Base class for person domain errors.
 */
export abstract class PersonDomainError extends Error {
  abstract readonly code: string;
}

/**
 * Thrown when a person is not found by TMDB id.
 */
export class PersonNotFoundError extends PersonDomainError {
  readonly code = 'PERSON_NOT_FOUND';
  readonly tmdbId: number;

  constructor(tmdbId: number) {
    super(`Person with TMDB id "${tmdbId}" not found`);
    this.name = 'PersonNotFoundError';
    this.tmdbId = tmdbId;
  }
}
