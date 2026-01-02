/**
 * Provider Module Public API
 *
 * Exports for use by other modules.
 */

// Module
export { ProviderModule } from '../provider.module';

// Services
export { ProviderRegistryService } from '../application/services/provider-registry.service';

// Repository tokens
export { PROVIDER_REGISTRY_REPOSITORY } from '../domain/repositories/provider-registry.repository.interface';

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
