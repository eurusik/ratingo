/**
 * Provider Module Public API
 *
 * Exports for use by other modules.
 */

// Module
export { ProviderModule } from '../provider.module';

// Services
export { ProviderRegistryService } from '../application/services/provider-registry.service';
export { ProviderMappingService } from '../application/services/provider-mapping.service';
export { UnmappedTrackingService } from '../application/services/unmapped-tracking.service';
export { NormalizationService } from '../application/services/normalization.service';

// Repository tokens
export { PROVIDER_REGISTRY_REPOSITORY } from '../domain/repositories/provider-registry.repository.interface';
export { PROVIDER_MAPPING_REPOSITORY } from '../domain/repositories/provider-mapping.repository.interface';
export { UNMAPPED_TRACKING_REPOSITORY } from '../domain/repositories/unmapped-tracking.repository.interface';
export { MEDIA_WATCH_OFFERS_REPOSITORY } from '../domain/repositories/media-watch-offers.repository.interface';

// Utils
export {
  normalizeRegion,
  isGlobalRegion,
  isValidRegionFormat,
  GLOBAL_REGION,
} from '../domain/utils/region-normalizer';

// Types & Constants
export {
  DISTRIBUTION_CHANNEL,
  OFFER_TYPE,
  MAPPING_SOURCE,
  type Provider,
  type ProviderVariant,
  type ProviderMapping,
  type UnmappedProvider,
  type MediaWatchOffer,
  type ResolvedMapping,
  type ProviderWithVariants,
  type DistributionChannel,
  type OfferType,
  type MappingSource,
  type CreateProviderDto,
  type UpdateProviderDto,
  type CreateMappingDto,
  type UpdateMappingDto,
} from '../domain/types/provider.types';

// Repository interfaces
export type { IProviderRegistryRepository } from '../domain/repositories/provider-registry.repository.interface';
export type { IProviderMappingRepository } from '../domain/repositories/provider-mapping.repository.interface';
export type {
  IUnmappedTrackingRepository,
  RecordUnmappedInput,
  FindAllUnmappedOptions,
} from '../domain/repositories/unmapped-tracking.repository.interface';
export type {
  IMediaWatchOffersRepository,
  CreateWatchOfferInput,
  FindOffersOptions,
  GetOffersForMediaBatchOptions,
  MediaWatchOfferView,
} from '../domain/repositories/media-watch-offers.repository.interface';

// Normalization types
export type {
  WatchProvidersMap,
  TmdbProvider,
  TmdbRegionData,
  NormalizationResult,
  BatchNormalizationResult,
} from '../application/services/normalization.service';
