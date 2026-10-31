/**
 * Shared contracts: pure types, enums and constants used across module
 * boundaries (catalog, ingestion, catalog-policy, tmdb).
 *
 * Must stay dependency-free: no Nest, Drizzle, BullMQ or other module
 * imports (only `common/enums`). This breaks the catalog <-> ingestion
 * cycle and keeps it importable from any role (API or worker).
 */

export {
  INGESTION_QUEUE,
  BACKFILL_QUEUE,
  RATINGS_BACKFILL_QUEUE,
  DEFAULT_INGESTION_JOB_OPTIONS,
} from './queues';

export { IngestionJob, type SyncMediaJobData } from './ingestion-jobs';

export { ContentClassValues, type ContentClass } from './content-class';

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
} from './normalized-media';
