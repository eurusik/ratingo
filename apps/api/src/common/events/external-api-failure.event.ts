import { HttpStatus } from '@nestjs/common';
import { type EventEmitter2 } from '@nestjs/event-emitter';

export const EXTERNAL_API_PROVIDER = {
  TMDB: 'tmdb',
  TRAKT: 'trakt',
  MDBLIST: 'mdblist',
  OMDB: 'omdb',
} as const;

export type ExternalApiProvider =
  (typeof EXTERNAL_API_PROVIDER)[keyof typeof EXTERNAL_API_PROVIDER];

export const EXTERNAL_API_FAILURE_EVENT = 'external-api.failure';

export interface ExternalApiFailureEvent {
  provider: ExternalApiProvider;
  statusCode: number;
}

export function isKeyFailureStatus(status: number): boolean {
  return (
    status === HttpStatus.UNAUTHORIZED ||
    status === HttpStatus.FORBIDDEN ||
    status === HttpStatus.TOO_MANY_REQUESTS
  );
}

export function emitExternalApiFailure(
  emitter: EventEmitter2,
  provider: ExternalApiProvider,
  status: number,
): void {
  if (!isKeyFailureStatus(status)) return;
  emitter.emit(EXTERNAL_API_FAILURE_EVENT, { provider, statusCode: status });
}
