'use client';

import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { notificationsApi, type NotificationItem, type NotificationList } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import {
  NOTIFICATIONS_KEY,
  UNREAD_COUNT_KEY,
  latestNotificationsKey,
  notificationPagesKey,
  type NotificationFilter,
} from './notification-keys';

const PAGE_SIZE = 20;
const LATEST_COUNT = 5;
const STALE_MS = 60 * 1000;
const READ_ALL_TOAST_KEY = 'notifications-read-all';

type CachedNotifications = NotificationList | InfiniteData<NotificationList> | number;

type IsRead = (item: NotificationItem) => boolean;

function markList(list: NotificationList, isRead: IsRead): NotificationList {
  const data = list.data.map((item) => (isRead(item) ? { ...item, isRead: true } : item));
  const newlyRead = list.data.filter((item, index) => !item.isRead && data[index].isRead).length;
  return { ...list, data, unreadCount: Math.max(0, list.unreadCount - newlyRead) };
}

function markCached(cached: CachedNotifications, isRead: IsRead, readCount: number) {
  if (typeof cached === 'number') return Math.max(0, cached - readCount);
  if ('pages' in cached) {
    return { ...cached, pages: cached.pages.map((page) => markList(page, isRead)) };
  }
  return markList(cached, isRead);
}

type Snapshot = Array<[QueryKey, CachedNotifications | undefined]>;

async function markEverywhere(
  queryClient: QueryClient,
  isRead: IsRead,
  readCount: number,
): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
  const snapshot = queryClient.getQueriesData<CachedNotifications>({ queryKey: NOTIFICATIONS_KEY });
  queryClient.setQueriesData<CachedNotifications>({ queryKey: NOTIFICATIONS_KEY }, (cached) =>
    cached !== undefined ? markCached(cached, isRead, readCount) : cached,
  );
  return snapshot;
}

function restore(queryClient: QueryClient, snapshot: Snapshot): void {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data);
}

export function useUnreadNotificationCount(): number {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => notificationsApi.unreadCount(),
    enabled: isAuthenticated,
    staleTime: STALE_MS,
  });
  return isAuthenticated ? (data ?? 0) : 0;
}

export function useLatestNotifications() {
  return useQuery({
    queryKey: latestNotificationsKey(LATEST_COUNT),
    queryFn: () => notificationsApi.list(LATEST_COUNT),
    staleTime: STALE_MS,
  });
}

export function useNotificationPages(filter: NotificationFilter) {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: notificationPagesKey(filter),
    queryFn: ({ pageParam }) => notificationsApi.list(PAGE_SIZE, pageParam, filter === 'unread'),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((total, page) => total + page.data.length, 0) : undefined,
    enabled: isAuthenticated,
    staleTime: STALE_MS,
  });
}

export function useMarkNotificationRead(): (item: NotificationItem) => void {
  const queryClient = useQueryClient();
  const { dict } = useTranslation();

  return useCallback(
    (item) => {
      if (item.isRead) return;
      void (async () => {
        const snapshot = await markEverywhere(queryClient, (other) => other.id === item.id, 1);
        try {
          await notificationsApi.markAsRead(item.id);
        } catch (error) {
          console.error('Marking a notification read failed', { id: item.id, error });
          restore(queryClient, snapshot);
          toast.danger(dict.notifications.failed);
        } finally {
          void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
        }
      })();
    },
    [dict, queryClient],
  );
}

export function useReadAllNotifications(): (unreadCount: number) => void {
  const queryClient = useQueryClient();
  const { dict } = useTranslation();

  return useCallback(
    (unreadCount) => {
      void (async () => {
        const snapshot = await markEverywhere(queryClient, () => true, unreadCount);
        showUndoToast({
          key: READ_ALL_TOAST_KEY,
          message: dict.notifications.allRead,
          undoLabel: dict.notifications.undo,
          onUndo: () => restore(queryClient, snapshot),
          onKept: () => {
            notificationsApi
              .markAllAsRead()
              .catch((error: unknown) => {
                console.error('Marking all notifications read failed', { error });
                restore(queryClient, snapshot);
                toast.danger(dict.notifications.failed);
              })
              .finally(() => void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }));
          },
        });
      })();
    },
    [dict, queryClient],
  );
}
