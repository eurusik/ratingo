/**
 * Hooks for managing activity lists (watching/completed/paused).
 * Uses React Query for caching.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE } from '@/core/api/me-lists.client';
import { queryKeys } from '@/core/query/keys';

/**
 * Fetch all history items (watching + completed).
 * Used as base for filtering.
 */
function useHistoryBase(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.history,
    queryFn: () => meListsApi.getHistory(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get items currently being watched (state: watching).
 */
export function useWatching(enabled = true) {
  const query = useHistoryBase(enabled);

  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          data: query.data.data.filter((item) => item.state === USER_MEDIA_STATE.WATCHING),
        }
      : undefined,
  };
}

/**
 * Get completed items (state: completed).
 */
export function useCompleted(enabled = true) {
  const query = useHistoryBase(enabled);

  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          data: query.data.data.filter((item) => item.state === USER_MEDIA_STATE.COMPLETED),
        }
      : undefined,
  };
}

/**
 * Get paused items.
 */
export function usePaused(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.paused,
    queryFn: () => meListsApi.getPaused(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Mutation hook to pause a media item.
 */
export function usePauseMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaItemId: string) => meListsApi.pauseMedia(mediaItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.history });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.paused });
    },
  });
}

/**
 * Mutation hook to resume a paused media item.
 */
export function useResumeMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaItemId: string) => meListsApi.resumeMedia(mediaItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.history });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.paused });
    },
  });
}

/**
 * Get user's media state for a specific item.
 * Returns null if user has no state for this media.
 */
export function useUserMediaState(mediaItemId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.userMedia.state(mediaItemId),
    queryFn: () => meListsApi.getState(mediaItemId),
    enabled: enabled && !!mediaItemId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Legacy exports for backwards compatibility
export const useWatchlist = useWatching;
export const useHistory = useCompleted;
