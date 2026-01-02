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
import { PROVIDER_MAPPING_REPOSITORY } from './domain/repositories/provider-mapping.repository.interface';
import { PROVIDER_REGISTRY_REPOSITORY } from './domain/repositories/provider-registry.repository.interface';
import { ProviderMappingRepository } from './infrastructure/repositories/provider-mapping.repository';
import { ProviderRegistryRepository } from './infrastructure/repositories/provider-registry.repository';

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
    // Services
    ProviderRegistryService,
    ProviderMappingService,
  ],
  exports: [
    PROVIDER_REGISTRY_REPOSITORY,
    PROVIDER_MAPPING_REPOSITORY,
    ProviderRegistryService,
    ProviderMappingService,
  ],
})
export class ProviderModule {}
