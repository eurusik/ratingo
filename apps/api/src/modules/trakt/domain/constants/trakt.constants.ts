/**
 * Default concurrency for Trakt API batch requests.
 * Set to 1 to avoid rate limiting (Trakt allows ~10 req/s but we share the limit).
 * With 2 API calls per item (search + watching), concurrency=1 means ~2 req/s.
 */
export const TRAKT_BATCH_CONCURRENCY = 1;

/**
 * Chunk size for bulk Trakt operations.
 * Process this many items, then pause before next chunk.
 */
export const TRAKT_BULK_CHUNK_SIZE = 10;

/**
 * Delay between chunks in bulk Trakt operations (ms).
 * Helps avoid hitting rate limits.
 */
export const TRAKT_BULK_CHUNK_DELAY_MS = 2000;

/**
 * Maximum number of seasons to fetch for drop-off analysis.
 */
export const MAX_SEASONS_FOR_ANALYSIS = 10;

/**
 * Media type literals for Trakt API.
 */
export type TraktMediaType = 'movie' | 'show';

/**
 * Media type constants.
 */
export const TRAKT_MEDIA_TYPE = {
  MOVIE: 'movie' as const,
  SHOW: 'show' as const,
};
