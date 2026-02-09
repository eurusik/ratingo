import { HTTPError } from 'ky';

/**
 * Determines whether a given error represents an HTTP 401 Unauthorized response.
 *
 * @param error - The value to inspect for an HTTP 401 Unauthorized error
 * @returns `true` if `error` is an HTTP 401 Unauthorized error, `false` otherwise
 */
function isUnauthorized(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 401;
}

/**
 * Decides whether an operation should be retried based on the number of prior failures and the encountered error.
 *
 * @param failureCount - The number of times the operation has already failed
 * @param error - The error that caused the most recent failure
 * @returns `true` if the operation should be retried; `false` otherwise. Specifically, returns `false` for HTTP 401 Unauthorized errors and otherwise returns `true` when `failureCount` is less than 2. 
 */
export function retryUnlessUnauthorized(failureCount: number, error: unknown): boolean {
  if (isUnauthorized(error)) return false;
  return failureCount < 2;
}