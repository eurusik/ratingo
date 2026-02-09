import { HTTPError } from 'ky';

function isUnauthorized(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 401;
}

export function retryUnlessUnauthorized(failureCount: number, error: unknown): boolean {
  if (isUnauthorized(error)) return false;
  return failureCount < 2;
}
