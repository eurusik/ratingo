/**
 * Hooks for managing activity lists (watching/completed/paused).
 * Uses React Query for caching.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE, type MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import type { MediaType } from '@/shared/types';
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

/**
 * Mutation hook to set a standalone rating for a media item.
 * Uses optimistic updates to show the new rating immediately.
 */
export function useSetRating(mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rating, mediaType }: { rating: number | null; mediaType: MediaType }) =>
      meListsApi.setRating(mediaItemId, rating, mediaType),

    onMutate: async ({ rating }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: queryKeys.userMedia.state(mediaItemId),
      });

      // Snapshot previous value for rollback
      const previousState = queryClient.getQueryData<MeUserMediaListItemDto | null>(
        queryKeys.userMedia.state(mediaItemId),
      );

      // Optimistic update: patch the rating on the cached state
      if (previousState) {
        queryClient.setQueryData<MeUserMediaListItemDto>(
          queryKeys.userMedia.state(mediaItemId),
          { ...previousState, rating },
        );
      } else {
        // First-time rater: create a synthetic optimistic object.
        // The onSuccess handler will replace it with the real server response.
        queryClient.setQueryData<MeUserMediaListItemDto>(
          queryKeys.userMedia.state(mediaItemId),
          { rating } as MeUserMediaListItemDto,
        );
      }

      return { previousState };
    },

    onSuccess: (data) => {
      // Replace with server response (source of truth)
      queryClient.setQueryData(queryKeys.userMedia.state(mediaItemId), data);
    },

    onError: (_error, _variables, context) => {
      // Rollback to previous state on failure
      if (context?.previousState !== undefined) {
        queryClient.setQueryData(
          queryKeys.userMedia.state(mediaItemId),
          context.previousState,
        );
      }
    },

    onSettled: () => {
      // Always refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.all });
    },
  });
}

// Legacy exports for backwards compatibility
export const useWatchlist = useWatching;
export const useHistory = useCompleted;
