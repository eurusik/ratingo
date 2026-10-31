/**
 * Public API for trakt module.
 *
 * This is the ONLY entry point for other modules to import from trakt.
 *
 * @example
 * // ✅ Correct
 * import { TraktRatingsPort, TRAKT_RATINGS_PORT } from '../trakt/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { TraktRatingsAdapter } from '../trakt/infrastructure/adapters/trakt-ratings.adapter';
 */

// Ports (contracts + tokens)
export { TraktRatingsPort, TRAKT_RATINGS_PORT } from '../domain/ports/trakt-ratings.port';
export { TraktListsPort, TRAKT_LISTS_PORT } from '../domain/ports/trakt-lists.port';

// Domain constants
export {
  TRAKT_MEDIA_TYPE,
  type TraktMediaType,
  TRAKT_BATCH_CONCURRENCY,
  TRAKT_BULK_CHUNK_SIZE,
  TRAKT_BULK_CHUNK_DELAY_MS,
  MAX_SEASONS_FOR_ANALYSIS,
} from '../domain/constants/trakt.constants';
