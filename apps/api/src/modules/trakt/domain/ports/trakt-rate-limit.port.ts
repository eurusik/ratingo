export interface TraktRateLimitPort {
  acquire(): Promise<void>;
}

export const TRAKT_RATE_LIMIT_PORT = Symbol('TRAKT_RATE_LIMIT_PORT');
