/**
 * React Query hooks for admin providers API.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  adminProvidersApi,
  type ProvidersListResponse,
  type UnmappedProvidersResponse,
  type MappingsListResponse,
  type CreateMappingRequest,
  type UpdateMappingRequest,
  type ResolveMappingResponse,
} from '../api/admin-providers.client';

// ============================================================================
// Query Keys
// ============================================================================

export const adminProvidersKeys = {
  all: ['admin', 'providers'] as const,
  list: (limit?: number, offset?: number, search?: string) =>
    [...adminProvidersKeys.all, 'list', limit ?? null, offset ?? null, search ?? null] as const,
  unmapped: (limit?: number, offset?: number, region?: string) =>
    [...adminProvidersKeys.all, 'unmapped', limit ?? null, offset ?? null, region ?? null] as const,
  mappings: (limit?: number, offset?: number, providerId?: string, region?: string) =>
    [
      ...adminProvidersKeys.all,
      'mappings',
      limit ?? null,
      offset ?? null,
      providerId ?? null,
      region ?? null,
    ] as const,
  resolve: (tmdbProviderId: number, region: string) =>
    [...adminProvidersKeys.all, 'resolve', tmdbProviderId, region] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching providers list.
 */
export function useAdminProviders(
  params?: { limit?: number; offset?: number; search?: string },
  options?: Omit<UseQueryOptions<ProvidersListResponse>, 'queryKey' | 'queryFn'>,
): UseQueryResult<ProvidersListResponse> {
  return useQuery({
    queryKey: adminProvidersKeys.list(params?.limit, params?.offset, params?.search),
    queryFn: () => adminProvidersApi.getProviders(params),
    ...options,
  });
}

/**
 * Hook for fetching unmapped providers.
 */
export function useUnmappedProviders(
  params?: { limit?: number; offset?: number; region?: string },
  options?: Omit<UseQueryOptions<UnmappedProvidersResponse>, 'queryKey' | 'queryFn'>,
): UseQueryResult<UnmappedProvidersResponse> {
  return useQuery({
    queryKey: adminProvidersKeys.unmapped(params?.limit, params?.offset, params?.region),
    queryFn: () => adminProvidersApi.getUnmapped(params),
    ...options,
  });
}

/**
 * Hook for fetching mappings.
 */
export function useMappings(
  params?: { limit?: number; offset?: number; providerId?: string; region?: string },
  options?: Omit<UseQueryOptions<MappingsListResponse>, 'queryKey' | 'queryFn'>,
): UseQueryResult<MappingsListResponse> {
  return useQuery({
    queryKey: adminProvidersKeys.mappings(
      params?.limit,
      params?.offset,
      params?.providerId,
      params?.region,
    ),
    queryFn: () => adminProvidersApi.getMappings(params),
    ...options,
  });
}

/**
 * Hook for resolving a mapping.
 */
export function useResolveMapping(
  tmdbProviderId: number,
  region: string,
  options?: Omit<UseQueryOptions<ResolveMappingResponse>, 'queryKey' | 'queryFn'>,
): UseQueryResult<ResolveMappingResponse> {
  return useQuery({
    queryKey: adminProvidersKeys.resolve(tmdbProviderId, region),
    queryFn: () => adminProvidersApi.resolveMapping(tmdbProviderId, region),
    enabled: tmdbProviderId > 0 && region.length > 0,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a mapping.
 */
export function useCreateMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMappingRequest) => adminProvidersApi.createMapping(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProvidersKeys.all });
    },
  });
}

/**
 * Hook for updating a mapping.
 */
export function useUpdateMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMappingRequest }) =>
      adminProvidersApi.updateMapping(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProvidersKeys.all });
    },
  });
}

/**
 * Hook for deleting a mapping.
 */
export function useDeleteMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminProvidersApi.deleteMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProvidersKeys.all });
    },
  });
}
