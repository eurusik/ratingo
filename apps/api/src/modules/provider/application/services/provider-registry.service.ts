/**
 * Provider Registry Service
 *
 * Application service for managing canonical provider brands.
 * Provides query and mutation operations for the provider registry.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { ErrorCode } from '../../../../common/enums/error-code.enum';
import { NotFoundException } from '../../../../common/exceptions';
import {
  type IProviderRegistryRepository,
  PROVIDER_REGISTRY_REPOSITORY,
} from '../../domain/repositories/provider-registry.repository.interface';
import {
  type Provider,
  type CreateProviderDto,
  type UpdateProviderDto,
} from '../../domain/types/provider.types';

@Injectable()
export class ProviderRegistryService {
  private readonly logger = new Logger(ProviderRegistryService.name);

  constructor(
    @Inject(PROVIDER_REGISTRY_REPOSITORY)
    private readonly providerRepository: IProviderRegistryRepository,
  ) {}

  /**
   * Finds all providers.
   * By default returns only active providers.
   */
  async findAll(options?: { includeInactive?: boolean }): Promise<Provider[]> {
    return this.providerRepository.findAll(options);
  }

  /**
   * Finds a provider by ID.
   * @throws NotFoundException if provider not found
   */
  async findById(id: string): Promise<Provider> {
    const provider = await this.providerRepository.findById(id);

    if (!provider) {
      throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND, `Provider ${id} not found`, {
        providerId: id,
      });
    }

    return provider;
  }

  /**
   * Finds a provider by ID, returns null if not found.
   */
  async findByIdOrNull(id: string): Promise<Provider | null> {
    return this.providerRepository.findById(id);
  }

  /**
   * Finds providers by brand group.
   * Returns only active providers.
   */
  async findByBrandGroup(brandGroup: string): Promise<Provider[]> {
    return this.providerRepository.findByBrandGroup(brandGroup);
  }

  /**
   * Creates a new provider.
   * Admin only operation.
   */
  async create(data: CreateProviderDto): Promise<Provider> {
    this.logger.log(`Creating provider ${data.id}`);
    return this.providerRepository.create(data);
  }

  /**
   * Updates an existing provider.
   * Admin only operation.
   * @throws NotFoundException if provider not found
   */
  async update(id: string, data: UpdateProviderDto): Promise<Provider> {
    // Verify provider exists
    const existing = await this.providerRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND, `Provider ${id} not found`, {
        providerId: id,
      });
    }

    this.logger.log(`Updating provider ${id}`);
    return this.providerRepository.update(id, data);
  }

  /**
   * Deactivates a provider (soft delete).
   * Admin only operation.
   * @throws NotFoundException if provider not found
   */
  async deactivate(id: string): Promise<void> {
    // Verify provider exists
    const existing = await this.providerRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND, `Provider ${id} not found`, {
        providerId: id,
      });
    }

    this.logger.log(`Deactivating provider ${id}`);
    await this.providerRepository.deactivate(id);
  }
}
