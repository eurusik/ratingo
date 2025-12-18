/**
 * React Query hooks for user actions (saved items, subscriptions).
 * Provides optimistic updates and cache invalidation.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { HTTPError } from 'ky';
import {
  userActionsApi,
  type MediaSaveStatusDto,
  type MediaSubscriptionStatusDto,
  type SaveActionResultDto,
  type SubscribeActionResultDto,
  type SavedItemList,
  type SubscriptionTrigger,
} from '../api';
import { queryKeys } from './keys';

/** Checks if error is a 401 Unauthorized. */
function isUnauthorized(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 401;
}

// ============================================================================
// Constants (derived from api-contract types)
// ============================================================================

const SAVED_ITEM_LIST: { FOR_LATER: SavedItemList; CONSIDERING: SavedItemList } = {
  FOR_LATER: 'for_later',
  CONSIDERING: 'considering',
};

const SUBSCRIPTION_TRIGGER: {
  RELEASE: SubscriptionTrigger;
  NEW_SEASON: SubscriptionTrigger;
  ON_STREAMING: SubscriptionTrigger;
} = {
  RELEASE: 'release',
  NEW_SEASON: 'new_season',
  ON_STREAMING: 'on_streaming',
};

// ============================================================================
// Saved Items Hooks
// ============================================================================

/**
 * Fetches save status of a media item.
 *
 * @param mediaItemId - Media item ID
 * @param options - Additional query options
 * @returns Query result with isForLater and isConsidering flags
 */
export function useSaveStatus(
  mediaItemId: string,
  options?: Omit<UseQueryOptions<MediaSaveStatusDto>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.userActions.savedItems.status(mediaItemId),
    queryFn: () => userActionsApi.getSaveStatus(mediaItemId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error) => {
      if (isUnauthorized(error)) return false;
      return failureCount < 2;
    },
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
 * Saves a media item to a list with optimistic updates.
 *
 * @returns Mutation with save function
 */
export function useSaveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: SaveItemVariables) => userActionsApi.saveItem(variables),

    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.userActions.savedItems.status(variables.mediaItemId),
      });

      // Snapshot previous value
      const previousStatus = queryClient.getQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId)
      );

      // Optimistic update
      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        {
          isForLater: variables.list === SAVED_ITEM_LIST.FOR_LATER,
          isConsidering: variables.list === SAVED_ITEM_LIST.CONSIDERING,
        }
      );

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        data.status
      );
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.savedItems.status(variables.mediaItemId),
          context.previousStatus
        );
      }
    },
  });
}

interface UnsaveItemVariables {
  mediaItemId: string;
  list: SavedItemList;
  context?: string;
}

/**
 * Removes a media item from a list with optimistic updates.
 *
 * @returns Mutation with unsave function
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
        queryKeys.userActions.savedItems.status(variables.mediaItemId)
      );

      // Optimistic update
      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        (old) => ({
          isForLater: variables.list === SAVED_ITEM_LIST.FOR_LATER ? false : old?.isForLater ?? false,
          isConsidering: variables.list === SAVED_ITEM_LIST.CONSIDERING ? false : old?.isConsidering ?? false,
        })
      );

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        data.status
      );
      // Invalidate saved items lists so /saved page updates
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.savedItems.status(variables.mediaItemId),
          context.previousStatus
        );
      }
    },
  });
}

// ============================================================================
// Subscriptions Hooks
// ============================================================================

/**
 * Fetches subscription status of a media item.
 *
 * @param mediaItemId - Media item ID
 * @param options - Additional query options
 * @returns Query result with subscription triggers
 */
export function useSubscriptionStatus(
  mediaItemId: string,
  options?: Omit<UseQueryOptions<MediaSubscriptionStatusDto>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.userActions.subscriptions.status(mediaItemId),
    queryFn: () => userActionsApi.getSubscriptionStatus(mediaItemId),
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      if (isUnauthorized(error)) return false;
      return failureCount < 2;
    },
    ...options,
  });
}

interface SubscribeVariables {
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  context?: string;
  reasonKey?: string;
}

/**
 * Subscribes to notifications for a media item with optimistic updates.
 *
 * @returns Mutation with subscribe function
 */
export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: SubscribeVariables) => userActionsApi.subscribe(variables),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.userActions.subscriptions.status(variables.mediaItemId),
      });

      const previousStatus = queryClient.getQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId)
      );

      // Optimistic update
      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        (old) => {
          const newTriggers = [...(old?.triggers ?? []), variables.trigger];
          return {
            triggers: newTriggers,
            hasRelease: newTriggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
            hasNewSeason: newTriggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
            hasOnStreaming: newTriggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
          };
        }
      );

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        data.status
      );
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.subscriptions.status(variables.mediaItemId),
          context.previousStatus
        );
      }
    },
  });
}

interface UnsubscribeVariables {
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  context?: string;
}

/**
 * Unsubscribes from notifications with optimistic updates.
 *
 * @returns Mutation with unsubscribe function
 */
export function useUnsubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: UnsubscribeVariables) => userActionsApi.unsubscribe(variables),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.userActions.subscriptions.status(variables.mediaItemId),
      });

      const previousStatus = queryClient.getQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId)
      );

      // Optimistic update
      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        (old) => {
          const newTriggers = (old?.triggers ?? []).filter((t) => t !== variables.trigger);
          return {
            triggers: newTriggers,
            hasRelease: newTriggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
            hasNewSeason: newTriggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
            hasOnStreaming: newTriggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
          };
        }
      );

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        data.status
      );
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.subscriptions.status(variables.mediaItemId),
          context.previousStatus
        );
      }
    },
  });
}
