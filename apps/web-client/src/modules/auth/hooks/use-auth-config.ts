/**
 * Hook for fetching auth configuration.
 *
 * Uses TanStack Query for automatic deduplication and caching.
 * GoogleButton and FacebookButton share a single request.
 */

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/core/api';

export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth', 'config'],
    queryFn: () => authApi.getAuthConfig(),
    staleTime: Infinity,
  });
}
