/**
 * React Query hooks for user actions (saved items, subscriptions).
 * Provides optimistic updates and cache invalidation.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import {
  userActionsApi,
  type MediaSaveStatusDto,
  type MediaSubscriptionStatusDto,
  type SavedItemList,
  type SubscriptionTrigger,
} from '../api';
import { queryKeys } from './keys';
import { updateBatchCaches } from '../saved-status/saved-status-provider';
import { isUnauthorized } from './utils';

// ============================================================================
// Constants (derived from api-contract types)
// ============================================================================

const SAVED_ITEM_LIST: { FOR_LATER: SavedItemList; CONSIDERING: SavedItemList } = {
  FOR_LATER: 'for_later',
  CONSIDERING: 'considering',
};

export const SUBSCRIPTION_TRIGGER: {
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
  options?: Omit<UseQueryOptions<MediaSaveStatusDto>, 'queryKey' | 'queryFn'>,
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
      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        data.status,
      );
      updateBatchCaches(queryClient, variables.mediaItemId, data.status);
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.all,
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('list');
        },
      });
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.savedItems.status(variables.mediaItemId),
          context.previousStatus,
        );
        updateBatchCaches(queryClient, variables.mediaItemId, context.previousStatus);
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
      queryClient.setQueryData<MediaSaveStatusDto>(
        queryKeys.userActions.savedItems.status(variables.mediaItemId),
        data.status,
      );
      updateBatchCaches(queryClient, variables.mediaItemId, data.status);
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.savedItems.all,
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('list');
        },
      });
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.savedItems.status(variables.mediaItemId),
          context.previousStatus,
        );
        updateBatchCaches(queryClient, variables.mediaItemId, context.previousStatus);
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
  options?: Omit<UseQueryOptions<MediaSubscriptionStatusDto>, 'queryKey' | 'queryFn'>,
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
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
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
        },
      );

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        data.status,
      );
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.subscriptions.status(variables.mediaItemId),
          context.previousStatus,
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
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
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
        },
      );

      return { previousStatus };
    },

    onSuccess: (data, variables) => {
      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        data.status,
      );
    },

    onError: (_error, variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.userActions.subscriptions.status(variables.mediaItemId),
          context.previousStatus,
        );
      }
    },
  });
}

// ============================================================================
// Notifications Hooks
// ============================================================================

/**
 * Fetches notifications for the current user.
 *
 * @param enabled - Whether to enable the query (e.g., only when authenticated)
 * @returns Query result with notifications and unread count
 */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userActions.notifications.list(),
    queryFn: () => userActionsApi.listNotifications({ limit: 20 }),
    enabled,
    staleTime: 1000 * 60, // 1 minute
    retry: (failureCount, error) => {
      if (isUnauthorized(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Fetches unread notification count.
 *
 * @param enabled - Whether to enable the query
 * @returns Query result with unread count
 */
export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userActions.notifications.unreadCount(),
    queryFn: () => userActionsApi.getUnreadCount(),
    enabled,
    staleTime: 1000 * 30, // 30 seconds
    retry: (failureCount, error) => {
      if (isUnauthorized(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Marks a notification as read.
 *
 * @returns Mutation with markAsRead function
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => userActionsApi.markNotificationAsRead(notificationId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.notifications.list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.notifications.unreadCount(),
      });
    },
  });
}

/**
 * Marks all notifications as read.
 *
 * @returns Mutation with markAllAsRead function
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userActionsApi.markAllNotificationsAsRead(),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.notifications.list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.userActions.notifications.unreadCount(),
      });
    },
  });
}
