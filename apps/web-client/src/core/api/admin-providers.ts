/**
 * Admin Providers API client.
 * Endpoints for managing provider mappings and unmapped providers.
 */

import { apiGet, apiPost, apiPut, apiDelete } from './client';

// ============================================================================
// Types
// ============================================================================

/** Provider from registry with media count. */
export interface ProviderListItem {
  id: string;
  name: string;
  logoPath: string | null;
  mediaCount: number;
}

/** Providers list response. */
export interface ProvidersListResponse {
  data: ProviderListItem[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/** Unmapped provider entry. */
export interface UnmappedProvider {
  id: string;
  tmdbProviderId: number;
  tmdbProviderName: string;
  region: string;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** Unmapped providers list response. */
export interface UnmappedProvidersResponse {
  data: UnmappedProvider[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/** Provider mapping entry. */
export interface ProviderMapping {
  id: string;
  tmdbProviderId: number;
  providerId: string;
  variantId: string;
  distributionChannel: string;
  region: string;
  source: string;
  createdAt: string;
}

/** Mappings list response. */
export interface MappingsListResponse {
  data: ProviderMapping[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/** Create mapping request. */
export interface CreateMappingRequest {
  tmdbProviderId: number;
  providerId: string;
  variantId?: string;
  distributionChannel?: string;
  region?: string;
}

/** Update mapping request. */
export interface UpdateMappingRequest {
  providerId?: string;
  variantId?: string;
  distributionChannel?: string;
}

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
  mapping: ResolvedMapping | null;
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
