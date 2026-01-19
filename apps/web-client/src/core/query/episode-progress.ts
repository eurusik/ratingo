/**
 * React Query hooks for episode watch progress.
 * Provides optimistic updates for smooth UX.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import {
  episodeProgressApi,
  type ShowProgressDto,
  type SeasonProgressDto,
} from '../api/episode-progress.client';
import { queryKeys } from './keys';

/** Checks if error is a 401 Unauthorized. */
function isUnauthorized(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 401;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetches watch progress for all seasons of a show.
 *
 * @param showId - Show UUID
 * @param options - Additional query options
 * @returns Query result with season progress
 */
export function useShowProgress(
  showId: string | undefined,
  options?: Omit<UseQueryOptions<ShowProgressDto>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.episodeProgress.showProgress(showId || ''),
    queryFn: () => episodeProgressApi.getShowProgress(showId!),
    enabled: !!showId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error) => {
      if (isUnauthorized(error)) return false;
      return failureCount < 2;
    },
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface ToggleEpisodeVariables {
  episodeId: string;
  seasonNumber: number;
  watched: boolean;
}

/**
 * Toggles episode watched status with optimistic updates.
 *
 * @param showId - Show UUID for cache invalidation
 * @returns Mutation with toggle function
 */
export function useToggleEpisodeWatched(showId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: ToggleEpisodeVariables) => {
      if (variables.watched) {
        await episodeProgressApi.markWatched(variables.episodeId);
      } else {
        await episodeProgressApi.markUnwatched(variables.episodeId);
      }
    },

    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.episodeProgress.showProgress(showId),
      });

      // Snapshot previous value
      const previousProgress = queryClient.getQueryData<ShowProgressDto>(
        queryKeys.episodeProgress.showProgress(showId),
      );

      // Optimistic update
      if (previousProgress) {
        const updatedSeasons = previousProgress.seasons.map((season): SeasonProgressDto => {
          if (season.seasonNumber !== variables.seasonNumber) {
            return season;
          }

          const newWatchedIds = variables.watched
            ? [...season.watchedEpisodeIds, variables.episodeId]
            : season.watchedEpisodeIds.filter((id) => id !== variables.episodeId);

          return {
            ...season,
            watchedCount: newWatchedIds.length,
            watchedEpisodeIds: newWatchedIds,
          };
        });

        queryClient.setQueryData<ShowProgressDto>(
          queryKeys.episodeProgress.showProgress(showId),
          {
            ...previousProgress,
            seasons: updatedSeasons,
          },
        );
      }

      return { previousProgress };
    },

    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousProgress) {
        queryClient.setQueryData(
          queryKeys.episodeProgress.showProgress(showId),
          context.previousProgress,
        );
      }
    },

    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({
        queryKey: queryKeys.episodeProgress.showProgress(showId),
      });
    },
  });
}
