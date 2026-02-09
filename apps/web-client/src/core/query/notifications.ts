import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { userActionsApi } from '../api';
import { queryKeys } from './keys';
import { retryUnlessUnauthorized } from './utils';

/**
 * Invalidate notification-related query caches (notifications list and unread count) on the given QueryClient.
 *
 * @param queryClient - The QueryClient whose notification caches will be invalidated
 */
function invalidateNotificationCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.userActions.notifications.list() });
  queryClient.invalidateQueries({ queryKey: queryKeys.userActions.notifications.unreadCount() });
}

/**
 * Provides a React Query for fetching the user's notifications (limited to 20).
 *
 * @param enabled - Controls whether the query is active; when `false` the query will not run
 * @returns The query result object for the notifications list (status, data, error, and helper methods)
 */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userActions.notifications.list(),
    queryFn: () => userActionsApi.listNotifications({ limit: 20 }),
    enabled,
    staleTime: 1000 * 60,
    retry: retryUnlessUnauthorized,
  });
}

/**
 * Provides a query that fetches the current unread notifications count.
 *
 * @param enabled - If `true`, the query is active and will run; if `false`, the query is disabled.
 * @returns A query result containing the unread notifications count. 
 */
export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userActions.notifications.unreadCount(),
    queryFn: () => userActionsApi.getUnreadCount(),
    enabled,
    staleTime: 1000 * 30,
    retry: retryUnlessUnauthorized,
  });
}

/**
 * Creates a mutation that marks a notification as read and invalidates notification-related caches on success.
 *
 * @returns A React Query mutation object which, when executed with a `notificationId`, calls the API to mark that notification as read and then invalidates the notifications list and unread count caches.
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => userActionsApi.markNotificationAsRead(notificationId),
    onSuccess: () => invalidateNotificationCaches(queryClient),
  });
}

/**
 * Create a mutation that marks all notifications as read.
 *
 * @returns A mutation object which, when executed, marks all notifications as read and invalidates the notifications list and unread count caches on success.
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userActionsApi.markAllNotificationsAsRead(),
    onSuccess: () => invalidateNotificationCaches(queryClient),
  });
}