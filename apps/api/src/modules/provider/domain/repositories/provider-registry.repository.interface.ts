/**
 * Provider Registry Repository Interface
 *
 * Repository contract for managing canonical provider brands.
 */

import {
  type Provider,
  type CreateProviderDto,
  type UpdateProviderDto,
} from '../types/provider.types';

export const PROVIDER_REGISTRY_REPOSITORY = Symbol('PROVIDER_REGISTRY_REPOSITORY');

export interface IProviderRegistryRepository {
  /**
   * Finds all providers.
   * @param options.includeInactive - Include inactive providers (default: false)
   */
  findAll(options?: { includeInactive?: boolean }): Promise<Provider[]>;

  /**
   * Finds a provider by ID.
   */
  findById(id: string): Promise<Provider | null>;

  /**
   * Finds providers by brand group.
   */
  findByBrandGroup(brandGroup: string): Promise<Provider[]>;

  /**
   * Creates a new provider.
   */
  create(data: CreateProviderDto): Promise<Provider>;

  /**
   * Updates an existing provider.
   */
  update(id: string, data: UpdateProviderDto): Promise<Provider>;

  /**
   * Deactivates a provider (soft delete).
   */
  deactivate(id: string): Promise<void>;
}
