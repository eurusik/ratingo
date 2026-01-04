/**
 * Provider Mapping Service
 *
 * Application service for resolving TMDB provider IDs to canonical providers.
 * Handles region-specific mappings with global fallback.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { ErrorCode } from '../../../../common/enums/error-code.enum';
import { NotFoundException } from '../../../../common/exceptions';
import {
  type IProviderMappingRepository,
  PROVIDER_MAPPING_REPOSITORY,
} from '../../domain/repositories/provider-mapping.repository.interface';
import type {
  ProviderMapping,
  CreateMappingDto,
  UpdateMappingDto,
  ResolvedMapping,
} from '../../domain/types/provider.types';
import { normalizeRegion } from '../../domain/utils/region-normalizer';

@Injectable()
export class ProviderMappingService {
  private readonly logger = new Logger(ProviderMappingService.name);

  constructor(
    @Inject(PROVIDER_MAPPING_REPOSITORY)
    private readonly mappingRepository: IProviderMappingRepository,
  ) {}

  /**
   * Resolves a TMDB provider ID to canonical provider mapping.
   * Checks region-specific first, then falls back to global.
   *
   * @returns ResolvedMapping or null if no mapping exists
   */
  async resolve(tmdbProviderId: number, region?: string): Promise<ResolvedMapping | null> {
    const normalizedRegion = normalizeRegion(region);
    return this.mappingRepository.resolve(tmdbProviderId, normalizedRegion);
  }

  /**
   * Batch resolves multiple TMDB provider IDs.
   * Uses 2 queries: region-specific, then global for missing.
   *
   * @returns Map of tmdbProviderId -> ResolvedMapping (only for found mappings)
   */
  async resolveMany(
    tmdbProviderIds: number[],
    region?: string,
  ): Promise<Map<number, ResolvedMapping>> {
    if (tmdbProviderIds.length === 0) {
      return new Map();
    }

    const normalizedRegion = normalizeRegion(region);
    return this.mappingRepository.resolveMany(tmdbProviderIds, normalizedRegion);
  }

  /**
   * Gets unmapped TMDB provider IDs from a list.
   * Useful for tracking which providers need mapping.
   */
  async getUnmappedIds(tmdbProviderIds: number[], region?: string): Promise<number[]> {
    const resolved = await this.resolveMany(tmdbProviderIds, region);
    return tmdbProviderIds.filter((id) => !resolved.has(id));
  }

  // --- Admin CRUD Operations ---

  /**
   * Finds a mapping by ID.
   * @throws NotFoundException if not found
   */
  async findById(id: string): Promise<ProviderMapping> {
    const mapping = await this.mappingRepository.findById(id);

    if (!mapping) {
      throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND, `Mapping ${id} not found`, {
        mappingId: id,
      });
    }

    return mapping;
  }

  /**
   * Finds all mappings for a region.
   */
  async findByRegion(region: string): Promise<ProviderMapping[]> {
    const normalizedRegion = normalizeRegion(region);
    return this.mappingRepository.findByRegion(normalizedRegion);
  }

  /**
   * Finds all mappings with optional filters.
   */
  async findAll(options?: {
    providerId?: string;
    region?: string;
    includeGlobal?: boolean;
  }): Promise<ProviderMapping[]> {
    return this.mappingRepository.findAll(options);
  }

  /**
   * Finds a mapping by TMDB ID and region.
   */
  async findByTmdbIdAndRegion(
    tmdbProviderId: number,
    region: string,
  ): Promise<ProviderMapping | null> {
    const normalizedRegion = normalizeRegion(region);
    return this.mappingRepository.findByTmdbIdAndRegion(tmdbProviderId, normalizedRegion);
  }

  /**
   * Creates a new mapping.
   * Admin only operation.
   */
  async create(data: CreateMappingDto): Promise<ProviderMapping> {
    this.logger.log(`Creating mapping TMDB ${data.tmdbProviderId} -> ${data.providerId}`);
    return this.mappingRepository.create(data);
  }

  /**
   * Updates an existing mapping.
   * Admin only operation.
   * @returns Updated mapping or null if not found
   */
  async update(id: string, data: UpdateMappingDto): Promise<ProviderMapping | null> {
    const existing = await this.mappingRepository.findById(id);
    if (!existing) {
      return null;
    }

    this.logger.log(`Updating mapping ${id}`);
    return this.mappingRepository.update(id, data);
  }

  /**
   * Deletes a mapping.
   * Admin only operation.
   * @returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const mapping = await this.mappingRepository.findById(id);
    if (!mapping) {
      return false;
    }

    this.logger.log(`Deleting mapping ${id}`);
    await this.mappingRepository.delete(id);
    return true;
  }
}
