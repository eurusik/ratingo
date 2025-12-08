/**
 * Standardized error codes for the API.
 * Used in error responses for client-side handling.
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Not found errors (404)
  MEDIA_NOT_FOUND = 'MEDIA_NOT_FOUND',
  STATS_NOT_FOUND = 'STATS_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // External API errors (502/503)
  TMDB_API_ERROR = 'TMDB_API_ERROR',
  TRAKT_API_ERROR = 'TRAKT_API_ERROR',
  OMDB_API_ERROR = 'OMDB_API_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',

  // Database errors (500)
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
