/**
 * Provider Module
 *
 * Module for the normalized provider registry system.
 * Manages canonical provider brands, TMDB mappings, and watch offers.
 */

import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { ProviderRegistryService } from './application/services/provider-registry.service';
import { PROVIDER_REGISTRY_REPOSITORY } from './domain/repositories/provider-registry.repository.interface';
import { ProviderRegistryRepository } from './infrastructure/repositories/provider-registry.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    // Repositories
    {
      provide: PROVIDER_REGISTRY_REPOSITORY,
      useClass: ProviderRegistryRepository,
    },
    // Services
    ProviderRegistryService,
  ],
  exports: [PROVIDER_REGISTRY_REPOSITORY, ProviderRegistryService],
})
export class ProviderModule {}
