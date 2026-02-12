/**
 * Notifications page list with filter toggle, mark-all-read, and load-more.
 * Main orchestrator for the notifications page.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Skeleton, ToggleGroup, ToggleGroupItem } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import {
  useNotificationsPage,
  useMarkAllNotificationsAsRead,
} from '@/core/query';
import { queryKeys } from '@/core/query/keys';
import { NotificationCard } from './notification-card';
import { NotificationsEmptyState } from './notifications-empty-state';

function NotificationsListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-cinema-card/50">
          <Skeleton className="w-16 h-24 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsList() {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [readFilter, setReadFilter] = useState<'unread' | 'all'>('unread');
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError } = useNotificationsPage({
    ...(readFilter === 'unread' && { unread: true }),
    enabled: isAuthenticated,
  });
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const markAllAsReadRef = useRef(markAllAsRead.mutate);
  markAllAsReadRef.current = markAllAsRead.mutate;

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        markAllAsReadRef.current();
      }
    };
  }, []);

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleMarkAllAsRead = () => {
    if (undoTimeoutRef.current) return;

    const limit = 20; // Must match useNotificationsPage default
    const unreadKey = queryKeys.userActions.notifications.list(true, limit);
    const allKey = queryKeys.userActions.notifications.list(null, limit);
    const unreadCountKey = queryKeys.userActions.notifications.unreadCount();

    // Snapshots for rollback
    const previousUnread = queryClient.getQueryData(unreadKey);
    const previousAll = queryClient.getQueryData(allKey);
    const previousUnreadCount = queryClient.getQueryData(unreadCountKey);

    // Optimistic update — both filter caches
    for (const key of [unreadKey, allKey]) {
      queryClient.setQueryData(key, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const typed = old as { data: { isRead: boolean }[]; unreadCount: number };
        return {
          ...typed,
          unreadCount: 0,
          data: typed.data.map((n) => ({ ...n, isRead: true })),
        };
      });
    }
    queryClient.setQueryData(unreadCountKey, () => ({ count: 0 }));

    // Clear any pending undo timeout
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    // Delayed API call
    undoTimeoutRef.current = setTimeout(() => {
      markAllAsRead.mutate();
      undoTimeoutRef.current = null;
    }, 5000);

    toast(dict.notifications.markedAllRead, {
      action: {
        label: dict.notifications.undo,
        onClick: () => {
          if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = null;
          }
          // Restore all snapshots
          queryClient.setQueryData(unreadKey, previousUnread);
          queryClient.setQueryData(allKey, previousAll);
          queryClient.setQueryData(unreadCountKey, previousUnreadCount);
          queryClient.invalidateQueries({ queryKey: queryKeys.userActions.notifications.all });
        },
      },
      duration: 5000,
    });
  };

  return (
    <div>
      {/* Subtitle */}
      <p className="text-sm text-cinema-text-muted mb-4">{dict.notifications.subtitle}</p>

      {/* Top bar: filter toggle + mark all read */}
      <div className="flex items-center justify-between mb-4">
        <ToggleGroup
          type="single"
          value={readFilter}
          onValueChange={(v) => v && setReadFilter(v as 'unread' | 'all')}
          className="gap-1"
        >
          <ToggleGroupItem
            value="unread"
            size="sm"
            className="h-8 px-3 text-sm data-[state=on]:bg-cinema-elevated data-[state=on]:text-cinema-text-primary data-[state=off]:text-cinema-text-muted"
          >
            {dict.notifications.filters.unread}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="all"
            size="sm"
            className="h-8 px-3 text-sm data-[state=on]:bg-cinema-elevated data-[state=on]:text-cinema-text-primary data-[state=off]:text-cinema-text-muted"
          >
            {dict.notifications.filters.all}
          </ToggleGroupItem>
        </ToggleGroup>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-cinema-text-muted hover:text-white"
            onClick={handleMarkAllAsRead}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            {dict.notifications.markAllRead}
          </Button>
        )}
      </div>

      {/* Content */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-cinema-text-muted text-sm">{dict.notifications.error}</p>
        </div>
      ) : isLoading ? (
        <NotificationsListSkeleton />
      ) : notifications.length === 0 ? (
        <NotificationsEmptyState
          variant={readFilter === 'unread' ? 'all-read' : 'no-notifications'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notifications.map((item) => (
            <NotificationCard
              key={item.id}
              trigger={item.trigger}
              payload={item.payload}
              isRead={item.isRead}
              createdAt={item.createdAt}
              mediaSummary={item.mediaSummary}
            />
          ))}
        </div>
      )}
    </div>
  );
}
