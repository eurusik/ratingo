'use client';

import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE, type MeListSort, type MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import type { MediaType } from '@/shared/types';
import { queryKeys } from '@/core/query/keys';

export type { MeListSort } from '@/core/api/me-lists.client';

const STALE_5_MIN = 1000 * 60 * 5;

function useHistoryBase(sort?: MeListSort, enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.history(sort),
    queryFn: () => meListsApi.getHistory(sort ? { sort } : undefined),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData: keepPreviousData,
  });
}

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

export function usePaused(sort?: MeListSort, enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.paused(sort),
    queryFn: () => meListsApi.getPaused(sort ? { sort } : undefined),
    enabled,
    staleTime: STALE_5_MIN,
    placeholderData: keepPreviousData,
  });
}

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
