'use client';

import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE, type MeListSort, type MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import type { MediaType } from '@/shared/types';
import { queryKeys } from '@/core/query/keys';
import { useFilterAwarePlaceholder } from './use-filter-aware-placeholder';

export type { MeListSort } from '@/core/api/me-lists.client';

const STALE_5_MIN = 1000 * 60 * 5;

/** Page size for progressive loading in Activity lists. */
export const PAGE_SIZE = 20;

/** Maximum number of items that can be loaded in a single Activity list. */
export const MAX_LIST_LIMIT = 100;

export type MediaTypeFilter = 'all' | 'movie' | 'show';

interface MeListOptions {
  sort?: MeListSort;
  type?: MediaTypeFilter;
  limit?: number;
  enabled?: boolean;
}

export function useWatching({ limit = PAGE_SIZE, type = 'all', enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  const placeholderData = useFilterAwarePlaceholder(type);
  return useQuery({
    queryKey: queryKeys.meLists.activity(apiType, limit),
    queryFn: () => meListsApi.getActivity({ limit, type: apiType }),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData,
  });
}

export function useCompleted({ sort, type = 'all', limit = PAGE_SIZE, enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  const placeholderData = useFilterAwarePlaceholder(type, sort);
  const query = useQuery({
    queryKey: queryKeys.meLists.history(sort, apiType, limit),
    queryFn: () => meListsApi.getHistory({ sort, limit, type: apiType }),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData,
  });

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

export function usePaused({ sort, type = 'all', limit = PAGE_SIZE, enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  const placeholderData = useFilterAwarePlaceholder(type, sort);
  return useQuery({
    queryKey: queryKeys.meLists.paused(sort, apiType, limit),
    queryFn: () => meListsApi.getPaused({ sort, limit, type: apiType }),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData,
  });
}

export function useCaughtUp({ sort, type = 'all', limit = PAGE_SIZE, enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  const placeholderData = useFilterAwarePlaceholder(type, sort);
  return useQuery({
    queryKey: queryKeys.meLists.caughtUp(sort, apiType, limit),
    queryFn: () => meListsApi.getCaughtUp({ sort, limit, type: apiType }),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData,
  });
}

export function useDropped({ sort, type = 'all', limit = PAGE_SIZE, enabled = true }: MeListOptions = {}) {
  const apiType = type === 'all' ? undefined : type;
  const placeholderData = useFilterAwarePlaceholder(type, sort);
  return useQuery({
    queryKey: queryKeys.meLists.dropped(sort, apiType, limit),
    queryFn: () => meListsApi.getDropped({ sort, limit, type: apiType }),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData,
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
    mutationFn: (mediaItemId: string) => meListsApi.dropMedia(mediaItemId),
    onSuccess: (_data, mediaItemId) => {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.meLists.ratingsAll });
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

// Rating does not move items between list buckets (watching/paused/dropped/
// completed/forLater/considering), so `meLists.counts` is not invalidated.
// Revisit if the backend ever auto-transitions state on rating (e.g. sets
// state=completed when user rates an unrated movie).
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
