/**
 * Hook for managing subscriptions (notifications).
 * Uses React Query for caching and mutations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userActionsApi, type SubscriptionTrigger } from '@/core/api/user-actions';

const QUERY_KEY = ['subscriptions'] as const;

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => userActionsApi.listSubscriptions(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      mediaItemId: string;
      trigger: SubscriptionTrigger;
      context?: string;
      reasonKey?: string;
    }) => userActionsApi.subscribe(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUnsubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      mediaItemId: string;
      trigger: SubscriptionTrigger;
      context?: string;
    }) => userActionsApi.unsubscribe(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
