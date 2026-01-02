/**
 * Provider Mapping Repository Interface
 *
 * Port for provider mapping persistence operations.
 */

import type {
  ProviderMapping,
  CreateMappingDto,
  UpdateMappingDto,
  ResolvedMapping,
} from '../types/provider.types';

export const PROVIDER_MAPPING_REPOSITORY = Symbol('PROVIDER_MAPPING_REPOSITORY');

export interface IProviderMappingRepository {
  /**
   * Finds a mapping by TMDB provider ID and region.
   * Returns null if not found.
   */
  findByTmdbIdAndRegion(tmdbProviderId: number, region: string): Promise<ProviderMapping | null>;

  /**
   * Finds all mappings for given TMDB provider IDs and region.
   * Returns a map of tmdbProviderId -> ProviderMapping.
   */
  findManyByTmdbIdsAndRegion(
    tmdbProviderIds: number[],
    region: string,
  ): Promise<Map<number, ProviderMapping>>;

  /**
   * Finds all mappings for a region (including global).
   */
  findByRegion(region: string): Promise<ProviderMapping[]>;

  /**
   * Finds a mapping by ID.
   */
  findById(id: string): Promise<ProviderMapping | null>;

  /**
   * Creates a new mapping.
   */
  create(data: CreateMappingDto): Promise<ProviderMapping>;

  /**
   * Updates an existing mapping.
   */
  update(id: string, data: UpdateMappingDto): Promise<ProviderMapping>;

  /**
   * Deletes a mapping by ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Resolves TMDB provider ID to canonical mapping.
   * Checks region-specific first, then falls back to global.
   * Returns null if no mapping exists.
   */
  resolve(tmdbProviderId: number, region: string): Promise<ResolvedMapping | null>;

  /**
   * Batch resolves multiple TMDB provider IDs.
   * Uses 2 queries: region-specific, then global for missing.
   * Returns a map of tmdbProviderId -> ResolvedMapping.
   */
  resolveMany(tmdbProviderIds: number[], region: string): Promise<Map<number, ResolvedMapping>>;
}
