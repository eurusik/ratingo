import { useQuery, useMutation, useQueryClient, type QueryClient, type UseQueryOptions } from '@tanstack/react-query';
import {
  userActionsApi,
  type MediaSaveStatusDto,
  type SavedItemList,
} from '../api';
import { queryKeys } from './keys';
import { updateBatchCaches } from '../saved-status/saved-status-provider';
import { retryUnlessUnauthorized } from './utils';

const SAVED_ITEM_LIST: { FOR_LATER: SavedItemList; CONSIDERING: SavedItemList } = {
  FOR_LATER: 'for_later',
  CONSIDERING: 'considering',
};

/**
 * Update the cached save status for a media item and refresh related cached entries.
 *
 * @param mediaItemId - ID of the media item whose status will be updated in cache
 * @param status - The new save status to store for the media item
 */
function setSaveStatus(queryClient: QueryClient, mediaItemId: string, status: MediaSaveStatusDto) {
  queryClient.setQueryData<MediaSaveStatusDto>(
    queryKeys.userActions.savedItems.status(mediaItemId),
    status,
  );
  updateBatchCaches(queryClient, mediaItemId, status);
}

/**
 * Invalidate cached saved-item list queries to force refetching fresh lists.
 *
 * Invalidates the `userActions.savedItems.all` list query (`...['list']`) and the `savedItems.all` query.
 */
function invalidateSavedItemLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: [...queryKeys.userActions.savedItems.all, 'list'],
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.savedItems.all });
}

/**
 * Fetches and caches the save status for a given media item.
 *
 * The query is cached for five minutes by default and uses `retryUnlessUnauthorized` for retry behavior.
 *
 * @param mediaItemId - The ID of the media item to fetch the save status for
 * @param options - Optional react-query options to customize the query; `queryKey` and `queryFn` cannot be overridden
 * @returns The query result containing the media item's save status
 */
export function useSaveStatus(
  mediaItemId: string,
  options?: Omit<UseQueryOptions<MediaSaveStatusDto>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.userActions.savedItems.status(mediaItemId),
    queryFn: () => userActionsApi.getSaveStatus(mediaItemId),
    staleTime: 1000 * 60 * 5,
    retry: retryUnlessUnauthorized,
    ...options,
  });
}

interface SaveItemVariables {
  mediaItemId: string;
  list: SavedItemList;
  context?: string;
  reasonKey?: string;
}

/**
 * Creates a react-query mutation for saving a media item with optimistic cache updates.
 *
 * The mutation calls the save API, writes an optimistic save status for the given list into the cache,
 * updates related batch caches, rolls back to the previous status on error, and invalidates the item's
 * save-status query and saved-item lists as appropriate.
 *
 * @returns The configured mutation object that performs the save operation and manages optimistic cache updates, rollback, and invalidation of related queries.
 */
export function useSaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: SaveItemVariables) => userActionsApi.saveItem(variables),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.userActions.savedItems.status(variables.mediaItemId),
      });

      const previousStatus = queryClient.getQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
      );

      const optimisticStatus: MediaSaveStatusDto = {
        isForLater: variables.list === SAVED_ITEM_LIST.FOR_LATER,
        isConsidering: variables.list === SAVED_ITEM_LIST.CONSIDERING,
      };

      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        optimisticStatus,
      );
      updateBatchCaches(queryClient, variables.mediaItemId, optimisticStatus);

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      setSaveStatus(queryClient, variables.mediaItemId, data.status);
      invalidateSavedItemLists(queryClient);
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        setSaveStatus(queryClient, variables.mediaItemId, context.previousStatus);
      }
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.status(variables.mediaItemId),
      });
    },
  });
}

interface UnsaveItemVariables {
  mediaItemId: string;
  list: SavedItemList;
  context?: string;
}

/**
 * Creates a mutation hook to remove a media item from a saved list while applying optimistic cache updates.
 *
 * The mutation updates the cached save status for the affected media item optimistically (clearing the flag for the specified list),
 * persists the change via the API, reverts to the previous cached status on error, and invalidates the item's status and saved-item lists as needed.
 *
 * @returns A react-query mutation object that accepts `UnsaveItemVariables` to perform the unsave operation and manages optimistic cache updates and invalidation.
 */
export function useUnsaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: UnsaveItemVariables) => userActionsApi.unsaveItem(variables),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.userActions.savedItems.status(variables.mediaItemId),
      });

      const previousStatus = queryClient.getQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
      );

      const optimisticStatus: MediaSaveStatusDto = {
        isForLater:
          variables.list === SAVED_ITEM_LIST.FOR_LATER ? false : (previousStatus?.isForLater ?? false),
        isConsidering:
          variables.list === SAVED_ITEM_LIST.CONSIDERING ? false : (previousStatus?.isConsidering ?? false),
      };

      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        optimisticStatus,
      );
      updateBatchCaches(queryClient, variables.mediaItemId, optimisticStatus);

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      setSaveStatus(queryClient, variables.mediaItemId, data.status);
      invalidateSavedItemLists(queryClient);
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        setSaveStatus(queryClient, variables.mediaItemId, context.previousStatus);
      }
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.status(variables.mediaItemId),
      });
    },
  });
}