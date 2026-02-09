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
 * Invalidates caches related to a show's episode progress and related user media lists to keep UI state consistent after episode-progress changes.
 *
 * @param showId - The show identifier whose episode-progress cache should be invalidated
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
}

// ============================================================================
// Query Hooks
/**
 * Fetches and caches progress information for a show.
 *
 * @param showId - The show's identifier; when `undefined` the query is disabled.
 * @param options - Additional react-query options to merge (cannot override `queryKey` or `queryFn`).
 * @returns The query result containing the show's `ShowProgressDto` data and associated query state.
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

/**
 * Toggles the watched state of a single episode for a show, performing an optimistic update to the show's progress and rolling back on error.
 *
 * @param showId - The ID of the show whose episode progress will be updated
 * @returns The React Query mutation object; call `mutate` or `mutateAsync` with `ToggleEpisodeVariables` to toggle an episode's watched state
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
      invalidateEpisodeProgressCaches(queryClient, showId);
    },
  });
}

/**
 * Creates a mutation to mark multiple episodes as watched for a show.
 *
 * @param showId - The ID of the show whose episode progress will be modified
 * @returns A React Query mutation object that accepts `{ episodeIds, seasonNumber }`; it applies an optimistic update to the show's progress cache, restores the previous cache on error, and invalidates related episode-progress and user media caches when settled
 */
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

/**
 * Creates a mutation to mark all specified episodes (grouped by season) as watched for a given show and update related caches optimistically.
 *
 * @param showId - The id of the show whose episode progress will be updated and whose related caches will be invalidated
 * @returns A React Query mutation object for submitting a batch "mark watched" operation; on success it invalidates related episode-progress caches and on error it restores the previous show progress cache
 */
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

/**
 * Provides a mutation hook to unmark (mark unwatched) multiple episodes for a show.
 *
 * @param showId - The identifier of the show whose episode progress caches will be invalidated after the mutation settles
 * @returns A mutation object that accepts an array of episode IDs to unmark; if the array is empty the mutation is a no-op
 */
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