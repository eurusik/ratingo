'use client';

import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE, type MeListSort, type MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import type { MediaType } from '@/shared/types';
import { queryKeys } from '@/core/query/keys';

export type { MeListSort } from '@/core/api/me-lists.client';

const STALE_5_MIN = 1000 * 60 * 5;

/**
 * Fetches the user's media history with optional sorting and cache control.
 *
 * @param sort - Optional sort order to apply to the returned history
 * @param enabled - Whether the query should be enabled
 * @returns The query result containing the list of user media history items and query status
 */
function useHistoryBase(sort?: MeListSort, enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.history(sort),
    queryFn: () => meListsApi.getHistory(sort ? { sort } : undefined),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData: keepPreviousData,
  });
}

/**
 * Exposes a query for the user's history filtered to items in the WATCHING state.
 *
 * @param sort - Optional sort order to apply when fetching history
 * @param enabled - Whether the query should be enabled
 * @returns The original query object with its `data` field replaced by the same page/collection shape but containing only items whose `state` is `USER_MEDIA_STATE.WATCHING`, or `undefined` if the base query has no data
 */
export function useWatching(sort?: MeListSort, enabled = true) {
  const query = useHistoryBase(sort, enabled);

  const data = useMemo(
    () =>
      query.data
        ? {
            ...query.data,
            data: query.data.data.filter((item) => item.state === USER_MEDIA_STATE.WATCHING),
          }
        : undefined,
    [query.data],
  );

  return { ...query, data };
}

/**
 * Provides a history query scoped to the user's media items that are in the COMPLETED state.
 *
 * @param sort - Optional sort order to apply when fetching the history
 * @param enabled - Whether the underlying query should be active
 * @returns A React Query result object for the history list where `data` (if present) contains only items whose `state` is `USER_MEDIA_STATE.COMPLETED`
 */
export function useCompleted(sort?: MeListSort, enabled = true) {
  const query = useHistoryBase(sort, enabled);

  const data = useMemo(
    () =>
      query.data
        ? {
            ...query.data,
            data: query.data.data.filter((item) => item.state === USER_MEDIA_STATE.COMPLETED),
          }
        : undefined,
    [query.data],
  );

  return { ...query, data };
}

/**
 * Fetches the user's media list entries that are in the PAUSED state.
 *
 * @param sort - Optional sort order to apply to the paused list
 * @param enabled - Whether the query should be active
 * @returns The React Query result containing the paused user media list data
 */
export function usePaused(sort?: MeListSort, enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.paused(sort),
    queryFn: () => meListsApi.getPaused(sort ? { sort } : undefined),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData: keepPreviousData,
  });
}

/**
 * Provides a mutation hook to pause a user's media item.
 *
 * The mutation accepts a media item ID and, on success, invalidates cached history and paused-list queries so related lists refresh.
 *
 * @returns A mutation object that accepts a media item ID to pause that item; on success invalidates the history and paused query groups.
 */
export function usePauseMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaItemId: string) => meListsApi.pauseMedia(mediaItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.pausedAll });
    },
  });
}

/**
 * Provides a mutation to resume a paused media item.
 *
 * @returns A mutation result object that triggers resuming the specified media item and, on success, invalidates the history and paused lists in the cache.
 */
export function useResumeMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaItemId: string) => meListsApi.resumeMedia(mediaItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.pausedAll });
    },
  });
}

/**
 * Fetches the current user's favorite updates.
 *
 * @param enabled - Whether this query is enabled; when `false`, the query will not run. Defaults to `true`.
 * @returns The React Query result object containing the favorite updates data and query status fields.
 */
export function useFavoriteUpdates(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.favoriteUpdates,
    queryFn: () => meListsApi.getFavoriteUpdates(),
    enabled,
    staleTime: STALE_5_MIN
  });
}

/**
 * Fetches the user's state and details for a specific media item.
 *
 * @param mediaItemId - The ID of the media item to fetch the user's state for.
 * @param enabled - When `false` (or when `mediaItemId` is falsy) the query is disabled.
 * @returns The query result containing the user's media state and related details for the item.
 */
export function useUserMediaState(mediaItemId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.userMedia.state(mediaItemId),
    queryFn: () => meListsApi.getState(mediaItemId),
    enabled: enabled && !!mediaItemId,
    staleTime: STALE_5_MIN
  });
}

/**
 * Creates a mutation hook to set the current user's rating for a specific media item with optimistic updates and cache synchronization.
 *
 * @param mediaItemId - The ID of the media item whose rating will be changed
 * @returns A React Query mutation object for updating the rating; performs an optimistic update of the cached user media state, restores the previous state on error, and invalidates related caches (user media state, reviews, batch ratings, and favorite updates) after the operation settles.
 */
export function useSetRating(mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rating, mediaType }: { rating: number | null; mediaType: MediaType }) =>
      meListsApi.setRating(mediaItemId, rating, mediaType),

    onMutate: async ({ rating }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.userMedia.state(mediaItemId),
      });

      const previousState = queryClient.getQueryData<MeUserMediaListItemDto | null>(
        queryKeys.userMedia.state(mediaItemId),
      );

      if (previousState) {
        queryClient.setQueryData<MeUserMediaListItemDto>(
          queryKeys.userMedia.state(mediaItemId),
          { ...previousState, rating },
        );
      }

      return { previousState };
    },

    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.userMedia.state(mediaItemId), data);
    },

    onError: (_error, _variables, context) => {
      if (context?.previousState !== undefined) {
        queryClient.setQueryData(
          queryKeys.userMedia.state(mediaItemId),
          context.previousState,
        );
      }
    },

    onSettled: () => {
      // Backend syncs standalone rating → review rating
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.myReview(mediaItemId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.mediaBase(mediaItemId),
      });
      // Refresh batch ratings so badges update immediately
      queryClient.invalidateQueries({
        queryKey: queryKeys.userMedia.batchRatingsAll,
      });
      // Rating changes may affect favorite updates (e.g. new show becomes favorite)
      queryClient.invalidateQueries({
        queryKey: queryKeys.meLists.favoriteUpdates,
      });
    },
  });
}