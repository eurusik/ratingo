/**
 * Admin Providers API client.
 * Endpoints for managing provider mappings and unmapped providers.
 */

import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

// ============================================================================
// Types from API Contract
// ============================================================================

/** Unmapped provider entry. */
export type UnmappedProvider = components['schemas']['UnmappedProviderDto'];

/** Unmapped providers list response. */
export type UnmappedProvidersResponse = components['schemas']['UnmappedProvidersListDto'];

/** Provider mapping entry. */
export type ProviderMapping = components['schemas']['MappingDto'];

/** Mappings list response. */
export type MappingsListResponse = components['schemas']['MappingsListDto'];

/** Create mapping request. */
export type CreateMappingRequest = components['schemas']['CreateMappingRequestDto'];

/** Update mapping request. */
export type UpdateMappingRequest = components['schemas']['UpdateMappingRequestDto'];

/** Distribution channel type. */
export type DistributionChannel = CreateMappingRequest['distributionChannel'];

/** Provider from registry with media count. */
export type ProviderListItem = components['schemas']['ProviderDto'];

/** Providers list response. */
export type ProvidersListResponse = components['schemas']['ProvidersListDto'];

/** Resolved mapping result. */
export interface ResolvedMapping {
  providerId: string;
  variantId: string;
  distributionChannel: string;
}

/** Resolve mapping response. */
export interface ResolveMappingResponse {
  tmdbProviderId: number;
  region: string;
  mapping: ProviderMapping | null;
  source: 'region' | 'global' | null;
}

// ============================================================================
// API Client
// ============================================================================

export const adminProvidersApi = {
  /**
   * Gets providers list from registry.
   */
  async getProviders(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<ProvidersListResponse> {
    return apiGet<ProvidersListResponse>('admin/providers', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Gets unmapped providers list.
   */
  async getUnmapped(params?: {
    limit?: number;
    offset?: number;
    region?: string;
  }): Promise<UnmappedProvidersResponse> {
    return apiGet<UnmappedProvidersResponse>('admin/providers/unmapped', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Gets mappings list.
   */
  async getMappings(params?: {
    limit?: number;
    offset?: number;
    providerId?: string;
    region?: string;
  }): Promise<MappingsListResponse> {
    return apiGet<MappingsListResponse>('admin/providers/mappings', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Creates a new mapping.
   */
  async createMapping(data: CreateMappingRequest): Promise<ProviderMapping> {
    return apiPost<ProviderMapping>('admin/providers/mappings', data);
  },

  /**
   * Updates an existing mapping.
   */
  async updateMapping(id: string, data: UpdateMappingRequest): Promise<ProviderMapping> {
    return apiPut<ProviderMapping>(`admin/providers/mappings/${id}`, data);
  },

  /**
   * Deletes a mapping.
   */
  async deleteMapping(id: string): Promise<void> {
    return apiDelete<void>(`admin/providers/mappings/${id}`);
  },

  /**
   * Resolves mapping for a TMDB provider ID and region.
   */
  async resolveMapping(tmdbProviderId: number, region: string): Promise<ResolveMappingResponse> {
    return apiGet<ResolveMappingResponse>('admin/providers/resolve', {
      searchParams: { tmdbProviderId, region },
    });
  },
} as const;
