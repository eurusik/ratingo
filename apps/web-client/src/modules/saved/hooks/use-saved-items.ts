/**
 * Hook for managing saved items (for_later and considering lists).
 * Uses React Query for caching and mutations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userActionsApi, type SavedItemList } from '@/core/api/user-actions.client';
import { queryKeys } from '@/core/query/keys';
import type { MediaTypeFilter } from './use-me-lists';
import { useFilterAwarePlaceholder } from './use-filter-aware-placeholder';

const STALE_5_MIN = 1000 * 60 * 5;

const QUERY_KEYS = {
  forLater: (type?: string) => ['saved-items', 'for-later', type ?? null] as const,
  considering: (type?: string) => ['saved-items', 'considering', type ?? null] as const,
};

export function useSavedForLater({ type = 'all', enabled = true }: { type?: MediaTypeFilter; enabled?: boolean } = {}) {
  const apiType = type === 'all' ? undefined : type;
  const placeholderData = useFilterAwarePlaceholder(type);
  return useQuery({
    queryKey: QUERY_KEYS.forLater(apiType),
    queryFn: () => userActionsApi.listForLater({ type: apiType }),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData,
  });
}

export function useSavedConsidering({ type = 'all', enabled = true }: { type?: MediaTypeFilter; enabled?: boolean } = {}) {
  const apiType = type === 'all' ? undefined : type;
  const placeholderData = useFilterAwarePlaceholder(type);
  return useQuery({
    queryKey: QUERY_KEYS.considering(apiType),
    queryFn: () => userActionsApi.listConsidering({ type: apiType }),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData,
  });
}

export function useSaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      mediaItemId: string;
      list: SavedItemList;
      context?: string;
      reasonKey?: string;
    }) => userActionsApi.saveItem(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
    },
  });
}

export function useUnsaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { mediaItemId: string; list: SavedItemList; context?: string }) =>
      userActionsApi.unsaveItem(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
    },
  });
}
