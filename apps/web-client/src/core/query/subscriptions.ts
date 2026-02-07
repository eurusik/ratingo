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

function buildSubscriptionStatus(triggers: string[]): MediaSubscriptionStatusDto {
  return {
    triggers,
    hasRelease: triggers.includes(SUBSCRIPTION_TRIGGER.RELEASE),
    hasNewSeason: triggers.includes(SUBSCRIPTION_TRIGGER.NEW_SEASON),
    hasOnStreaming: triggers.includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
  };
}

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
