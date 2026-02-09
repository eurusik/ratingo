import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import {
  userActionsApi,
  type MediaSubscriptionStatusDto,
  type SubscriptionTrigger,
} from '../api';
import { queryKeys } from './keys';
import { retryUnlessUnauthorized } from './utils';

export const SUBSCRIPTION_TRIGGER: {
  RELEASE: SubscriptionTrigger;
  NEW_SEASON: SubscriptionTrigger;
  ON_STREAMING: SubscriptionTrigger;
} = {
  RELEASE: 'release',
  NEW_SEASON: 'new_season',
  ON_STREAMING: 'on_streaming',
};

/**
 * Builds a MediaSubscriptionStatusDto from an array of subscription trigger identifiers.
 *
 * @param triggers - Array of subscription trigger identifiers (e.g. `release`, `new_season`, `on_streaming`)
 * @returns An object containing the original `triggers` array and boolean flags (`hasRelease`, `hasNewSeason`, `hasOnStreaming`) indicating which triggers are present
 */
function buildSubscriptionStatus(triggers: string[]): MediaSubscriptionStatusDto {
  return {
    triggers,
    hasRelease: triggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
    hasNewSeason: triggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
    hasOnStreaming: triggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
  };
}

/**
 * Provides a hook that fetches and caches the subscription status for a given media item.
 *
 * @param mediaItemId - The identifier of the media item whose subscription status should be fetched.
 * @param options - Optional React Query options to customize the query; `queryKey` and `queryFn` are overridden by the hook.
 * @returns The query result containing the media item's subscription status as a `MediaSubscriptionStatusDto`.
 */
export function useSubscriptionStatus(
  mediaItemId: string,
  options?: Omit<UseQueryOptions<MediaSubscriptionStatusDto>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.userActions.subscriptions.status(mediaItemId),
    queryFn: () => userActionsApi.getSubscriptionStatus(mediaItemId),
    staleTime: 1000 * 60 * 5,
    retry: retryUnlessUnauthorized,
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
 * Creates a mutation hook to subscribe to a media item for a specific trigger, performing optimistic cache updates and rollback on error.
 *
 * The mutation will optimistically add the requested trigger to the cached subscription status, replace the cached status with the server response on success, and restore the previous cached status if the mutation fails.
 *
 * @returns A React Query mutation result that resolves to the updated `MediaSubscriptionStatusDto` on success and exposes mutation lifecycle methods and state.
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

      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        (old) => buildSubscriptionStatus([...(old?.triggers ?? []), variables.trigger]),
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
 * Creates a React Query mutation for unsubscribing a trigger from a media item's subscription status.
 *
 * Optimistically removes the specified trigger from the cached subscription status, replaces the cache with the server-provided status on success, and restores the previous cache if the mutation errors.
 *
 * @returns A mutation result that executes the unsubscribe request and yields the updated `MediaSubscriptionStatusDto` on success.
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

      queryClient.setQueryData<MediaSubscriptionStatusDto>(
        queryKeys.userActions.subscriptions.status(variables.mediaItemId),
        (old) =>
          buildSubscriptionStatus(
            (old?.triggers ?? []).filter((t) => t !== variables.trigger),
          ),
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