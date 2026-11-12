'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/shared/api';

const LATEST_COUNT = 5;
const NOTIFICATIONS_KEY = ['notifications'] as const;
const LATEST_KEY = [...NOTIFICATIONS_KEY, 'latest', LATEST_COUNT] as const;
const LATEST_STALE_MS = 60 * 1000;

export function useLatestNotifications() {
  return useQuery({
    queryKey: LATEST_KEY,
    queryFn: () => notificationsApi.list(LATEST_COUNT),
    staleTime: LATEST_STALE_MS,
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: notificationsApi.markAsRead, onSuccess: invalidate });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: notificationsApi.markAllAsRead, onSuccess: invalidate });
}
