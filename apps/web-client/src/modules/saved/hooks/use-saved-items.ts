/**
 * Hook for managing saved items (for_later and considering lists).
 * Uses React Query for caching and mutations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userActionsApi, type SavedItemList } from '@/core/api/user-actions';

const QUERY_KEYS = {
  forLater: ['saved-items', 'for-later'] as const,
  considering: ['saved-items', 'considering'] as const,
};

export function useSavedForLater(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.forLater,
    queryFn: () => userActionsApi.listForLater(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSavedConsidering(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.considering,
    queryFn: () => userActionsApi.listConsidering(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
    },
  });
}

export function useUnsaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      mediaItemId: string;
      list: SavedItemList;
      context?: string;
    }) => userActionsApi.unsaveItem(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });
}
