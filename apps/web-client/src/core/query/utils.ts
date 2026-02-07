import { HTTPError } from 'ky';

export function isUnauthorized(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 401;
}
