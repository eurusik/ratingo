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

// Repository tokens
export { PROVIDER_REGISTRY_REPOSITORY } from '../domain/repositories/provider-registry.repository.interface';
export { PROVIDER_MAPPING_REPOSITORY } from '../domain/repositories/provider-mapping.repository.interface';
export { UNMAPPED_TRACKING_REPOSITORY } from '../domain/repositories/unmapped-tracking.repository.interface';

// Utils
export {
  normalizeRegion,
  isGlobalRegion,
  isValidRegionFormat,
  GLOBAL_REGION,
} from '../domain/utils/region-normalizer';

// Types
export type {
  Provider,
  ProviderVariant,
  ProviderMapping,
  UnmappedProvider,
  MediaWatchOffer,
  ResolvedMapping,
  ProviderWithVariants,
  DistributionChannel,
  OfferType,
  MappingSource,
  CreateProviderDto,
  UpdateProviderDto,
  CreateMappingDto,
  UpdateMappingDto,
} from '../domain/types/provider.types';

// Repository interfaces
export type { IProviderRegistryRepository } from '../domain/repositories/provider-registry.repository.interface';
export type { IProviderMappingRepository } from '../domain/repositories/provider-mapping.repository.interface';
export type {
  IUnmappedTrackingRepository,
  RecordUnmappedInput,
  FindAllUnmappedOptions,
} from '../domain/repositories/unmapped-tracking.repository.interface';
