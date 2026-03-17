/**
 * React Query hooks for episode watch progress.
 * Provides optimistic updates for smooth UX.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type QueryClient } from '@tanstack/react-query';
import {
  episodeProgressApi,
  type ShowProgressDto,
  type SeasonProgressDto,
} from '../api/episode-progress.client';
import { queryKeys } from './keys';
import { retryUnlessUnauthorized } from './utils';

/**
 * Invalidates all caches affected by episode progress changes.
 * Used by all episode progress mutation hooks to ensure consistency.
 */
function invalidateEpisodeProgressCaches(queryClient: QueryClient, showId: string) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.episodeProgress.showProgress(showId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.userMedia.all,
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.meLists.historyAll,
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.userActions.savedItems.all,
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.savedItems.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.shows.personalizedCalendarAll });
}

// ============================================================================
// Query Hooks
// ============================================================================

export function useShowProgress(
  showId: string | undefined,
  options?: Omit<UseQueryOptions<ShowProgressDto>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.episodeProgress.showProgress(showId || ''),
    queryFn: () => episodeProgressApi.getShowProgress(showId!),
    enabled: !!showId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: retryUnlessUnauthorized,
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

interface MarkMultipleWatchedVariables {
  episodeIds: string[];
  seasonNumber: number;
}

interface MarkAllEpisodesVariables {
  /** All episode IDs grouped by season number */
  episodesBySeasonNumber: Map<number, string[]>;
}

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
      invalidateEpisodeProgressCaches(queryClient, showId);
    },
  });
}

export function useMarkMultipleWatched(showId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: MarkMultipleWatchedVariables) => {
      await episodeProgressApi.markBatchWatched(variables.episodeIds);
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.episodeProgress.showProgress(showId),
      });

      const previousProgress = queryClient.getQueryData<ShowProgressDto>(
        queryKeys.episodeProgress.showProgress(showId),
      );

      // Optimistic update for all episodes
      if (previousProgress) {
        const updatedSeasons = previousProgress.seasons.map((season): SeasonProgressDto => {
          if (season.seasonNumber !== variables.seasonNumber) {
            return season;
          }

          const newWatchedIds = [
            ...new Set([...season.watchedEpisodeIds, ...variables.episodeIds]),
          ];

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
      if (context?.previousProgress) {
        queryClient.setQueryData(
          queryKeys.episodeProgress.showProgress(showId),
          context.previousProgress,
        );
      }
    },

    onSettled: () => {
      invalidateEpisodeProgressCaches(queryClient, showId);
    },
  });
}

export function useMarkAllEpisodesWatched(showId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: MarkAllEpisodesVariables) => {
      const allEpisodeIds: string[] = [];
      variables.episodesBySeasonNumber.forEach((ids) => {
        allEpisodeIds.push(...ids);
      });
      await episodeProgressApi.markBatchWatched(allEpisodeIds);
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.episodeProgress.showProgress(showId),
      });

      const previousProgress = queryClient.getQueryData<ShowProgressDto>(
        queryKeys.episodeProgress.showProgress(showId),
      );

      if (previousProgress) {
        const updatedSeasons = previousProgress.seasons.map((season): SeasonProgressDto => {
          const episodeIds = variables.episodesBySeasonNumber.get(season.seasonNumber);
          if (!episodeIds) return season;

          return {
            ...season,
            watchedCount: episodeIds.length,
            watchedEpisodeIds: episodeIds,
          };
        });

        queryClient.setQueryData<ShowProgressDto>(
          queryKeys.episodeProgress.showProgress(showId),
          { ...previousProgress, seasons: updatedSeasons },
        );
      }

      return { previousProgress };
    },

    onError: () => {
      // Partial chunks may have already succeeded on the server,
      // so rolling back to a stale snapshot would show incorrect state.
      // Force refetch to get the true server state instead.
      invalidateEpisodeProgressCaches(queryClient, showId);
    },

    onSettled: () => {
      invalidateEpisodeProgressCaches(queryClient, showId);
    },
  });
}

export function useUnmarkEpisodes(showId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (episodeIdsToUnmark: string[]) => {
      if (episodeIdsToUnmark.length === 0) return;
      await episodeProgressApi.markBatchUnwatched(episodeIdsToUnmark);
    },

    onSettled: () => {
      invalidateEpisodeProgressCaches(queryClient, showId);
    },
  });
}
