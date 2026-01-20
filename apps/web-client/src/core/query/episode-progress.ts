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

interface MarkMultipleWatchedVariables {
  episodeIds: string[];
  seasonNumber: number;
}

interface MarkAllEpisodesVariables {
  /** All episode IDs grouped by season number */
  episodesBySeasonNumber: Map<number, string[]>;
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
      // Invalidate user media state (for verdict CTA continuePoint)
      queryClient.invalidateQueries({
        queryKey: queryKeys.userMedia.all,
      });
      // Invalidate activity lists (watching/completed may change)
      queryClient.invalidateQueries({
        queryKey: queryKeys.meLists.history,
      });
      // Invalidate saved items (for_later is auto-removed when starting to watch)
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.all,
      });
      // Invalidate legacy saved-items queries (used by saved module)
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });
}

/**
 * Marks multiple episodes as watched with optimistic updates.
 * Used for "mark previous episodes" feature.
 *
 * @param showId - Show UUID for cache invalidation
 * @returns Mutation with bulk mark function
 */
export function useMarkMultipleWatched(showId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: MarkMultipleWatchedVariables) => {
      // Mark all episodes in parallel
      await Promise.all(
        variables.episodeIds.map((episodeId) => episodeProgressApi.markWatched(episodeId)),
      );
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.episodeProgress.showProgress(showId),
      });
      // Invalidate user media state (for verdict CTA continuePoint)
      queryClient.invalidateQueries({
        queryKey: queryKeys.userMedia.all,
      });
      // Invalidate activity lists (watching/completed may change)
      queryClient.invalidateQueries({
        queryKey: queryKeys.meLists.history,
      });
      // Invalidate saved items (for_later is auto-removed when starting to watch)
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.all,
      });
      // Invalidate legacy saved-items queries (used by saved module)
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });
}

const BATCH_SIZE = 20;

async function processInBatches<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(processor));
  }
}

/**
 * Marks ALL episodes of a show as watched.
 * Returns previous state for undo functionality.
 */
export function useMarkAllEpisodesWatched(showId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: MarkAllEpisodesVariables) => {
      const allEpisodeIds: string[] = [];
      variables.episodesBySeasonNumber.forEach((ids) => {
        allEpisodeIds.push(...ids);
      });
      await processInBatches(allEpisodeIds, (id) => episodeProgressApi.markWatched(id));
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.episodeProgress.showProgress(showId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.userMedia.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.meLists.history,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.all,
      });
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });
}

/**
 * Unmarks episodes (for undo). Accepts episode IDs directly to avoid race conditions.
 */
export function useUnmarkEpisodes(showId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (episodeIdsToUnmark: string[]) => {
      if (episodeIdsToUnmark.length === 0) return;
      await processInBatches(episodeIdsToUnmark, (id) => episodeProgressApi.markUnwatched(id));
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.episodeProgress.showProgress(showId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.userMedia.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.meLists.history,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.all,
      });
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });
}
