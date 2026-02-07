import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { userActionsApi } from '../api';
import { queryKeys } from './keys';
import { retryUnlessUnauthorized } from './utils';

function invalidateNotificationCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.userActions.notifications.list() });
  queryClient.invalidateQueries({ queryKey: queryKeys.userActions.notifications.unreadCount() });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userActions.notifications.list(),
    queryFn: () => userActionsApi.listNotifications({ limit: 20 }),
    enabled,
    staleTime: 1000 * 60,
    retry: retryUnlessUnauthorized,
  });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userActions.notifications.unreadCount(),
    queryFn: () => userActionsApi.getUnreadCount(),
    enabled,
    staleTime: 1000 * 30,
    retry: retryUnlessUnauthorized,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => userActionsApi.markNotificationAsRead(notificationId),
    onSuccess: () => invalidateNotificationCaches(queryClient),
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userActionsApi.markAllNotificationsAsRead(),
    onSuccess: () => invalidateNotificationCaches(queryClient),
  });
}
