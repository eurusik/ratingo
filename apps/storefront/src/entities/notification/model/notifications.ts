'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
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
  PAGES_SEGMENT,
  latestNotificationsKey,
  notificationPagesKey,
  type NotificationFilter,
} from './notification-keys';
import { pendingReadAll } from './pending-read-all';

const PAGE_SIZE = 20;
const LATEST_COUNT = 5;
const STALE_MS = 60 * 1000;
const READ_ALL_TOAST_KEY = 'notifications-read-all';

type CachedNotifications = NotificationList | InfiniteData<NotificationList> | number;

function markRead(list: NotificationList, isRead: (item: NotificationItem) => boolean) {
  const data = list.data.map((item) => (isRead(item) ? { ...item, isRead: true } : item));
  const newlyRead = list.data.filter((item, index) => !item.isRead && data[index].isRead).length;
  return { ...list, data, unreadCount: Math.max(0, list.unreadCount - newlyRead) };
}

function markAllRead(list: NotificationList): NotificationList {
  return markRead(list, () => true);
}

function markOneCached(cached: CachedNotifications, id: string): CachedNotifications {
  if (typeof cached === 'number') return Math.max(0, cached - 1);
  const isRead = (item: NotificationItem) => item.id === id;
  if ('pages' in cached) {
    return { ...cached, pages: cached.pages.map((page) => markRead(page, isRead)) };
  }
  return markRead(cached, isRead);
}

function isNotPaged(query: { queryKey: QueryKey }): boolean {
  return !query.queryKey.includes(PAGES_SEGMENT);
}

function usePendingReadAll(): boolean {
  return useSyncExternalStore(pendingReadAll.subscribe, pendingReadAll.isPending, () => false);
}

export function useUnreadNotificationCount(): number {
  const { isAuthenticated } = useAuth();
  const isReadingAll = usePendingReadAll();
  const { data } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => notificationsApi.unreadCount(),
    enabled: isAuthenticated,
    staleTime: STALE_MS,
  });
  return isAuthenticated && !isReadingAll ? (data ?? 0) : 0;
}

export function useLatestNotifications() {
  const { isAuthenticated } = useAuth();
  const isReadingAll = usePendingReadAll();
  return useQuery({
    enabled: isAuthenticated,
    queryKey: latestNotificationsKey(LATEST_COUNT),
    queryFn: () => notificationsApi.list(LATEST_COUNT),
    staleTime: STALE_MS,
    select: isReadingAll ? markAllRead : undefined,
  });
}

function loadedOffset(pages: readonly NotificationList[], filter: NotificationFilter): number {
  const items = pages.flatMap((page) => page.data);
  return filter === 'unread' ? items.filter((item) => !item.isRead).length : items.length;
}

const markAllPagesRead = (data: InfiniteData<NotificationList>) => ({
  ...data,
  pages: data.pages.map(markAllRead),
});

export function useNotificationPages(filter: NotificationFilter) {
  const { isAuthenticated } = useAuth();
  const isReadingAll = usePendingReadAll();
  return useInfiniteQuery({
    queryKey: notificationPagesKey(filter),
    queryFn: ({ pageParam }) => notificationsApi.list(PAGE_SIZE, pageParam, filter === 'unread'),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? loadedOffset(pages, filter) : undefined),
    enabled: isAuthenticated,
    staleTime: STALE_MS,
    select: isReadingAll ? markAllPagesRead : undefined,
  });
}

export function useMarkNotificationRead(): (item: NotificationItem) => void {
  const queryClient = useQueryClient();
  const { dict } = useTranslation();

  return useCallback(
    (item) => {
      if (item.isRead && !pendingReadAll.isPending()) return;
      void (async () => {
        await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY, predicate: isNotPaged });
        queryClient.setQueriesData<CachedNotifications>(
          { queryKey: NOTIFICATIONS_KEY },
          (cached) => (cached === undefined ? cached : markOneCached(cached, item.id)),
        );
        try {
          await notificationsApi.markAsRead(item.id);
          void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
        } catch (error) {
          console.error('Marking a notification read failed', { id: item.id, error });
          toast.danger(dict.notifications.failed);
          void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
        }
      })();
    },
    [dict, queryClient],
  );
}

export function useReadAllNotifications(): () => void {
  const queryClient = useQueryClient();
  const { dict } = useTranslation();

  return useCallback(() => {
    const token = pendingReadAll.start();
    showUndoToast({
      key: READ_ALL_TOAST_KEY,
      message: dict.notifications.allRead,
      undoLabel: dict.notifications.undo,
      onUndo: () => pendingReadAll.finish(token),
      onKept: () => {
        void notificationsApi
          .markAllAsRead()
          .catch((error: unknown) => {
            console.error('Marking all notifications read failed', { error });
            toast.danger(dict.notifications.failed);
          })
          .then(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }))
          .finally(() => pendingReadAll.finish(token));
      },
    });
  }, [dict, queryClient]);
}
