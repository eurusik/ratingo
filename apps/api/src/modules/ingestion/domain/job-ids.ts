import { formatUtcDayId } from '../../../common/utils/date.util';

export type SyncMediaJobScope = 'daily' | 'oneshot';

/**
 * Builds a deterministic job ID for SYNC_MOVIE/SYNC_SHOW BullMQ jobs.
 * - 'daily': deduplicates per UTC day (trending pipeline use case)
 * - 'oneshot': deduplicates until the job completes (resolve-import use case)
 */
export function buildSyncMediaJobId(
  type: 'movie' | 'show',
  tmdbId: number,
  scope: SyncMediaJobScope,
): string {
  const base = `${type}_${tmdbId}`;
  if (scope === 'daily') {
    return `${base}_${formatUtcDayId()}`;
  }
  return `${base}_oneshot`;
}
