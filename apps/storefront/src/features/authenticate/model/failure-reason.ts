import { ApiError } from '@ratingo/web-core/api';

export function failureReason(error: unknown): string {
  return error instanceof ApiError ? error.code : 'unknown';
}
