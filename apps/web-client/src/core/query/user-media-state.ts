'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meListsApi, type MeUserMediaListItemDto } from '@/core/api/me-lists.client';
import type { MediaType } from '@/shared/types';
import { queryKeys } from './keys';

const STALE_5_MIN = 1000 * 60 * 5;

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
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.myReview(mediaItemId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.mediaBase(mediaItemId) });
      // Refresh batch ratings so badges update immediately
      void queryClient.invalidateQueries({ queryKey: queryKeys.userMedia.batchRatingsAll });
      // Rating changes may affect favorite updates (e.g. new show becomes favorite)
      void queryClient.invalidateQueries({ queryKey: queryKeys.meLists.favoriteUpdates });
      // First-time ratings auto-create a user_media_state row (completed for movies,
      // watching for shows). Refresh all affected list views so new entries appear immediately.
      void queryClient.invalidateQueries({ queryKey: queryKeys.meLists.historyAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.meLists.activityAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.meLists.ratingsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.meLists.counts });
    },
  });
}
