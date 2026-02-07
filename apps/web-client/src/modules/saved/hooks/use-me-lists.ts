'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, USER_MEDIA_STATE, type MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import type { MediaType } from '@/shared/types';
import { queryKeys } from '@/core/query/keys';

const STALE_5_MIN = 1000 * 60 * 5;

function useHistoryBase(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.history,
    queryFn: () => meListsApi.getHistory(),
    enabled,
    staleTime: STALE_5_MIN
  });
}

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

export function usePaused(enabled = true) {
  return useQuery({
    queryKey: queryKeys.meLists.paused,
    queryFn: () => meListsApi.getPaused(),
    enabled,
    staleTime: STALE_5_MIN
  });
}

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

      queryClient.setQueryData<MeUserMediaListItemDto>(
        queryKeys.userMedia.state(mediaItemId),
        previousState ? { ...previousState, rating } : ({ rating } as MeUserMediaListItemDto),
      );

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
    },
  });
}

