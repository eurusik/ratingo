import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { userActionsApi } from '../api';
import { queryKeys } from './keys';
import { retryUnlessUnauthorized } from './utils';

function invalidateNotificationCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.userActions.notifications.all });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userActions.notifications.list(null, 20),
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

export interface UseNotificationsPageOptions {
  unread?: boolean;
  enabled?: boolean;
}

const NOTIFICATIONS_PAGE_SIZE = 20;

export function useNotificationsPage(options: UseNotificationsPageOptions = {}) {
  const { unread, enabled = true } = options;
  return useInfiniteQuery({
    queryKey: queryKeys.userActions.notifications.list(unread ?? null),
    queryFn: ({ pageParam = 0 }) =>
      userActionsApi.listNotifications({ limit: NOTIFICATIONS_PAGE_SIZE, offset: pageParam, unread }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.reduce((sum, p) => sum + p.data.length, 0) : undefined,
    enabled,
    staleTime: 1000 * 60,
    retry: retryUnlessUnauthorized,
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userActionsApi.markAllNotificationsAsRead(),
    onSuccess: () => invalidateNotificationCaches(queryClient),
  });
}
