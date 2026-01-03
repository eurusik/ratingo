/**
 * Provider Module
 *
 * Module for the normalized provider registry system.
 * Manages canonical provider brands, TMDB mappings, and watch offers.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { ProviderMappingService } from './application/services/provider-mapping.service';
import { ProviderRegistryService } from './application/services/provider-registry.service';
import { UnmappedTrackingService } from './application/services/unmapped-tracking.service';
import { PROVIDER_MAPPING_REPOSITORY } from './domain/repositories/provider-mapping.repository.interface';
import { PROVIDER_REGISTRY_REPOSITORY } from './domain/repositories/provider-registry.repository.interface';
import { UNMAPPED_TRACKING_REPOSITORY } from './domain/repositories/unmapped-tracking.repository.interface';
import { ProviderMappingRepository } from './infrastructure/repositories/provider-mapping.repository';
import { ProviderRegistryRepository } from './infrastructure/repositories/provider-registry.repository';
import { UnmappedTrackingRepository } from './infrastructure/repositories/unmapped-tracking.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    // Repositories
    {
      provide: PROVIDER_REGISTRY_REPOSITORY,
      useClass: ProviderRegistryRepository,
    },
    {
      provide: PROVIDER_MAPPING_REPOSITORY,
      useClass: ProviderMappingRepository,
    },
    {
      provide: UNMAPPED_TRACKING_REPOSITORY,
      useClass: UnmappedTrackingRepository,
    },
    // Services
    ProviderRegistryService,
    ProviderMappingService,
    UnmappedTrackingService,
  ],
  exports: [
    PROVIDER_REGISTRY_REPOSITORY,
    PROVIDER_MAPPING_REPOSITORY,
    UNMAPPED_TRACKING_REPOSITORY,
    ProviderRegistryService,
    ProviderMappingService,
    UnmappedTrackingService,
  ],
})
export class ProviderModule {}
