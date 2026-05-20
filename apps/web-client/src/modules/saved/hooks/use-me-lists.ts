'use client';

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE, type MeListSort, type MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import type { MediaType } from '@/shared/types';
import { queryKeys } from '@/core/query/keys';

export type { MeListSort } from '@/core/api/me-lists.client';

const STALE_5_MIN = 1000 * 60 * 5;

/** Page size for progressive loading in Activity lists. */
export const PAGE_SIZE = 20;

export type MediaTypeFilter = 'all' | 'movie' | 'show';

interface MeListOptions {
  sort?: MeListSort;
  type?: MediaTypeFilter;
  enabled?: boolean;
}

function getNextOffset(lastPage: { meta?: { hasMore?: boolean; offset?: number; limit?: number } }): number | undefined {
  if (!lastPage.meta?.hasMore) return undefined;
  return (lastPage.meta.offset ?? 0) + (lastPage.meta.limit ?? PAGE_SIZE);
}

export function useWatching({ type = 'all', enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  return useInfiniteQuery({
    queryKey: queryKeys.meLists.activity(apiType),
    queryFn: ({ pageParam = 0 }) => meListsApi.getActivity({ limit: PAGE_SIZE, offset: pageParam, type: apiType }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled,
    staleTime: STALE_5_MIN,
  });
}

export function useCompleted({ sort, type = 'all', enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  return useInfiniteQuery({
    queryKey: queryKeys.meLists.history(sort, apiType),
    queryFn: ({ pageParam = 0 }) =>
      meListsApi.getHistory({
        sort,
        limit: PAGE_SIZE,
        offset: pageParam,
        type: apiType,
        state: USER_MEDIA_STATE.COMPLETED,
      }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled,
    staleTime: STALE_5_MIN,
  });
}

export function usePaused({ sort, type = 'all', enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  return useInfiniteQuery({
    queryKey: queryKeys.meLists.paused(sort, apiType),
    queryFn: ({ pageParam = 0 }) => meListsApi.getPaused({ sort, limit: PAGE_SIZE, offset: pageParam, type: apiType }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled,
    staleTime: STALE_5_MIN,
  });
}

export function useCaughtUp({ sort, type = 'all', enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  return useInfiniteQuery({
    queryKey: queryKeys.meLists.caughtUp(sort, apiType),
    queryFn: ({ pageParam = 0 }) => meListsApi.getCaughtUp({ sort, limit: PAGE_SIZE, offset: pageParam, type: apiType }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled,
    staleTime: STALE_5_MIN,
  });
}

export function useDropped({ sort, type = 'all', enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  return useInfiniteQuery({
    queryKey: queryKeys.meLists.dropped(sort, apiType),
    queryFn: ({ pageParam = 0 }) => meListsApi.getDropped({ sort, limit: PAGE_SIZE, offset: pageParam, type: apiType }),
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled,
    staleTime: STALE_5_MIN,
  });
}

/**
 * Fetches aggregated counts for all user lists in a single request.
 * Used to render tab-count badges without pulling full list payloads.
 *
 * `keepPreviousData` avoids badge flicker (briefly showing 0) during
 * background refetches triggered by invalidations.
 *
 * Note: `watching` count uses strict `state=watching` matching while the
 * Watchlist tab list uses `/me/activity` (state OR progress), so badge
 * and list totals may differ for shows with progress in paused/dropped
 * state. Aligning this is a follow-up.
 */
export function useListCounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.counts,
    queryFn: () => meListsApi.getListCounts(),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData: keepPreviousData,
  });
}

export function usePauseMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaItemId: string) => meListsApi.pauseMedia(mediaItemId),
    onSuccess: (_data, mediaItemId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.activityAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.ratingsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.pausedAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.caughtUpAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.state(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.personalizedCalendarAll });
    },
  });
}

export function useResumeMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaItemId: string) => meListsApi.resumeMedia(mediaItemId),
    onSuccess: (_data, mediaItemId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.activityAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.ratingsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.pausedAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.caughtUpAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.state(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.personalizedCalendarAll });
    },
  });
}

export function useDropMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mediaItemId, mediaType }: { mediaItemId: string; mediaType: MediaType }) =>
      meListsApi.dropMedia(mediaItemId, mediaType),
    onSuccess: (_data, { mediaItemId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.activityAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.ratingsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.pausedAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.caughtUpAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.watchlistAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.droppedAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.state(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.personalizedCalendarAll });
    },
  });
}

export function useRestoreMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaItemId: string) => meListsApi.restoreMedia(mediaItemId),
    onSuccess: (_data, mediaItemId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.activityAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.ratingsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.pausedAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.caughtUpAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.watchlistAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.droppedAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.state(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.personalizedCalendarAll });
    },
  });
}

export function useFavoriteUpdates(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.favoriteUpdates,
    queryFn: () => meListsApi.getFavoriteUpdates(),
    enabled,
    staleTime: STALE_5_MIN
  });
}

export function useUserMediaState(mediaItemId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.userMedia.state(mediaItemId),
    queryFn: () => meListsApi.getState(mediaItemId),
    enabled: enabled && !!mediaItemId,
    staleTime: STALE_5_MIN
  });
}

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
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.myReview(mediaItemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.mediaBase(mediaItemId) });
      // Refresh batch ratings so badges update immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.batchRatingsAll });
      // Rating changes may affect favorite updates (e.g. new show becomes favorite)
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.favoriteUpdates });
      // First-time ratings auto-create a user_media_state row (completed for movies,
      // watching for shows). Refresh all affected list views so new entries appear immediately.
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.activityAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.ratingsAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
    },
  });
}
