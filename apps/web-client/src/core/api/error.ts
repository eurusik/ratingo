/**
 * API error types and classes.
 *
 * Provides typed error handling for API responses.
 */

/** Structure of API error response from backend. */
export interface ApiErrorDetail {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Custom error class for API failures.
 *
 * @example
 * try {
 *   await apiGet('/path');
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     console.log(error.code, error.statusCode);
 *   }
 * }
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Creates ApiError from backend error response.
   *
   * @param error - Error detail from API response
   */
  static fromResponse(error: ApiErrorDetail): ApiError {
    return new ApiError(error.code, error.statusCode, error.message, error.details);
  }
}
