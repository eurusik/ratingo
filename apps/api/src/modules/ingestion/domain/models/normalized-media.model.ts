/**
 * Normalized media types now live in shared/contracts so catalog (and other
 * consumers) can use them without depending on ingestion. Re-exported here
 * for ingestion-internal imports.
 */
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
} from '../../../shared/contracts';
