/**
 * Public API for ingestion module.
 *
 * This is the ONLY entry point for other modules to import from ingestion.
 *
 * @example
 * // ✅ Correct
 * import { MetadataProviderPort, NormalizedMedia } from '../ingestion/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { NormalizedMedia } from '../ingestion/domain/models/normalized-media.model';
 */

// Ports (contracts for external providers)
export {
  MetadataProviderPort,
  METADATA_PROVIDER_PORT,
} from '../domain/ports/metadata-provider.port';

// Models (contract types)
export type {
  NormalizedMedia,
  NormalizedVideo,
  NormalizedSeason,
  NormalizedEpisode,
  Credits,
  CastMember,
  CrewMember,
  WatchProvider,
  WatchProviderRegion,
  WatchProvidersMap,
} from '../domain/models/normalized-media.model';

// Interfaces
export type { ShowSyncDiff, ShowSyncChanges } from '../domain/interfaces/show-sync-diff.interface';

export {
  createEmptyDiff,
  formatEpisodeKey,
  formatSeasonKey,
  formatDateToIso,
  parseSeasonFromEpisodeKey,
} from '../domain/interfaces/show-sync-diff.interface';

// Constants
export {
  INGESTION_QUEUE,
  BACKFILL_QUEUE,
  IngestionJob,
  DEFAULT_INGESTION_JOB_OPTIONS,
} from '../ingestion.constants';

// Domain events
export { MediaSyncedEvent } from '../domain/events/media-synced.event';

// Job ID utilities
export { buildSyncMediaJobId } from '../domain/job-ids';
export type { SyncMediaJobScope } from '../domain/job-ids';
