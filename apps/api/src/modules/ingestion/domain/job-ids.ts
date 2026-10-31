import { formatUtcDayId, formatUtcHourId } from '../../../common/utils/date.util';

export type SyncMediaJobScope = 'daily' | 'window' | 'oneshot';

/**
 * Builds a deterministic job ID for SYNC_MOVIE/SYNC_SHOW BullMQ jobs.
 * - 'daily': deduplicates per UTC day
 * - 'window': deduplicates per dispatch window (trending pipeline use case). Retained
 *   completed jobs from a previous cycle must not suppress the next cycle, otherwise
 *   trendingUpdatedAt is not bumped and trending ranks are cleared as stale.
 *   Pass the dispatcher's window; defaults to the current UTC hour bucket (YYYYMMDDHH).
 * - 'oneshot': deduplicates until the job completes (resolve-import use case)
 */
export function buildSyncMediaJobId(
  type: 'movie' | 'show',
  tmdbId: number,
  scope: SyncMediaJobScope,
  window?: string,
): string {
  const base = `${type}_${tmdbId}`;
  if (scope === 'daily') {
    return `${base}_${formatUtcDayId()}`;
  }
  if (scope === 'window') {
    return `${base}_${window ?? formatUtcHourId()}`;
  }
  return `${base}_oneshot`;
}

/**
 * Builds a job ID for new-releases SYNC_MOVIE jobs. Uses a distinct 'nr' prefix so it
 * never collides with trending sync job IDs (which also embed the movie id).
 */
export function buildNewReleaseJobId(tmdbId: number): string {
  return `nr_movie_${tmdbId}_${formatUtcDayId()}`;
}
