'use client';

import { useMemo, useCallback } from 'react';
import { useAdminProviders } from '@/core/query/admin-providers';

/**
 * Hook for resolving provider canonical IDs to display names.
 *
 * Fetches providers from registry and provides a resolver function.
 * Falls back to ID if provider not found.
 */
export function useProviderNames() {
  const { data } = useAdminProviders({ limit: 100 });
  const providers = data?.data ?? [];

  const providerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const provider of providers) {
      map.set(provider.id, provider.displayName);
    }
    return map;
  }, [providers]);

  const resolveNames = useCallback(
    (ids: string[]): string[] => {
      return ids.map((id) => providerMap.get(id) ?? id);
    },
    [providerMap],
  );

  const resolveName = useCallback(
    (id: string): string => {
      return providerMap.get(id) ?? id;
    },
    [providerMap],
  );

  return { resolveNames, resolveName, providerMap };
}
