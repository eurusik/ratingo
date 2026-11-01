import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  adminMonitoringApi,
  type KeyHealthDashboard,
  type KeyHealthHistory,
} from '../api/admin-monitoring.client';

import { retryUnlessUnauthorized } from './utils';

const DASHBOARD_REFETCH_INTERVAL_MS = 60_000;

export const adminMonitoringKeys = {
  all: ['admin', 'monitoring'] as const,
  dashboard: () => [...adminMonitoringKeys.all, 'keys'] as const,
  history: (provider: string, limit?: number) =>
    [...adminMonitoringKeys.all, 'history', provider, limit ?? null] as const,
};

export function useKeyHealth(
  options?: Omit<UseQueryOptions<KeyHealthDashboard>, 'queryKey' | 'queryFn'>,
): UseQueryResult<KeyHealthDashboard> {
  return useQuery({
    queryKey: adminMonitoringKeys.dashboard(),
    queryFn: () => adminMonitoringApi.getKeys(),
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
    retry: retryUnlessUnauthorized,
    ...options,
  });
}

export function useKeyHealthHistory(
  provider: string,
  limit?: number,
  options?: Omit<UseQueryOptions<KeyHealthHistory>, 'queryKey' | 'queryFn'>,
): UseQueryResult<KeyHealthHistory> {
  return useQuery({
    queryKey: adminMonitoringKeys.history(provider, limit),
    queryFn: () => adminMonitoringApi.getHistory(provider, limit),
    retry: retryUnlessUnauthorized,
    ...options,
  });
}

export function useCheckKeysNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminMonitoringApi.checkNow(),
    onSuccess: (data) => {
      queryClient.setQueryData(adminMonitoringKeys.dashboard(), data);
    },
  });
}
