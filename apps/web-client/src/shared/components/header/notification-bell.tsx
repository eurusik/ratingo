/**
 * Notification bell component for header.
 * Shows actual notification events (new seasons, releases, etc.).
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useNotifications, useMarkAllNotificationsAsRead } from '@/core/query/user-actions';
import { useAuth } from '@/core/auth';

export function NotificationBell() {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useNotifications(isAuthenticated);
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => {
        toast.success(dict.notifications.markedAllRead);
      },
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const hasNotifications = notifications.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500" />
          )}
          <span className="sr-only">{dict.notifications.title}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-zinc-900 border-zinc-800">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-medium text-zinc-100">{dict.notifications.title}</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              {dict.notifications.markAllRead}
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-zinc-500 text-sm">...</div>
          ) : !hasNotifications ? (
            <div className="p-4 text-center text-zinc-500 text-sm">{dict.notifications.empty}</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {notifications.slice(0, 5).map((item) => {
                const media = item.mediaSummary;
                const href =
                  media.type === 'movie' ? `/movies/${media.slug}` : `/shows/${media.slug}`;

                const triggerLabel = {
                  release: dict.notifications.events.released,
                  new_season: dict.notifications.events.newSeason,
                  new_episode: dict.notifications.events.newEpisode,
                  on_streaming: dict.notifications.events.onStreaming,
                  status_changed: dict.notifications.events.statusChanged,
                }[item.trigger];

                return (
                  <Link
                    key={item.id}
                    href={href as Route}
                    className={`flex items-start gap-3 p-3 hover:bg-zinc-800/50 transition-colors ${
                      !item.isRead ? 'bg-zinc-800/30' : ''
                    }`}
                  >
                    <div className="relative w-10 h-14 rounded overflow-hidden bg-zinc-800 shrink-0">
                      {media.poster?.small ? (
                        <Image
                          src={media.poster.small}
                          alt={media.title}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                          —
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-400">{triggerLabel}</p>
                      <p className="text-sm font-medium text-zinc-100 truncate">{media.title}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-zinc-800">
          <Link href={'/saved?tab=notifications' as Route}>
            <Button variant="ghost" className="w-full text-sm text-zinc-400 hover:text-white">
              {dict.notifications.viewAll}
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
