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

function setSaveStatus(queryClient: QueryClient, mediaItemId: string, status: MediaSaveStatusDto) {
  queryClient.setQueryData<MediaSaveStatusDto>(
    queryKeys.userActions.savedItems.status(mediaItemId),
    status,
  );
  updateBatchCaches(queryClient, mediaItemId, status);
}

function invalidateSavedItemLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.userActions.savedItems.all,
    predicate: (query) => {
      const key = query.queryKey;
      return Array.isArray(key) && key.includes('list');
    },
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.savedItems.all });
}

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
  });
}

interface UnsaveItemVariables {
  mediaItemId: string;
  list: SavedItemList;
  context?: string;
}

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
  });
}
