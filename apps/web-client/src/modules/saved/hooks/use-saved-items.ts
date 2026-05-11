/**
 * Hooks for managing saved items (for_later and considering lists).
 * Uses TanStack Query infinite-query so the list grows page-by-page
 * with no client-side cap.
 */

'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userActionsApi, type SavedItemList } from '@/core/api/user-actions.client';
import { queryKeys } from '@/core/query/keys';
import type { MediaTypeFilter } from './use-me-lists';
import { PAGE_SIZE } from './use-me-lists';

const STALE_5_MIN = 1000 * 60 * 5;

const QUERY_KEYS = {
  forLater: (type?: string) => ['saved-items', 'for-later', type ?? null] as const,
  considering: (type?: string) => ['saved-items', 'considering', type ?? null] as const,
};

interface UseSavedListOptions {
  type?: MediaTypeFilter;
  enabled?: boolean;
}

export function useSavedForLater({ type = 'all', enabled = true }: UseSavedListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.forLater(apiType),
    queryFn: ({ pageParam = 0 }) =>
      userActionsApi.listForLater({ type: apiType, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore
        ? (lastPage.meta.offset ?? 0) + (lastPage.meta.limit ?? PAGE_SIZE)
        : undefined,
    enabled,
    staleTime: STALE_5_MIN,
  });
}

export function useSavedConsidering({ type = 'all', enabled = true }: UseSavedListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.considering(apiType),
    queryFn: ({ pageParam = 0 }) =>
      userActionsApi.listConsidering({ type: apiType, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore
        ? (lastPage.meta.offset ?? 0) + (lastPage.meta.limit ?? PAGE_SIZE)
        : undefined,
    enabled,
    staleTime: STALE_5_MIN,
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
