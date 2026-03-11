/**
 * Notification bell component for header.
 * Shows actual notification events (new seasons, releases, etc.).
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '@/core/query';
import { useAuth } from '@/core/auth';

export function NotificationBell() {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useNotifications(isAuthenticated);
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead.mutate(notificationId);
    }
    setOpen(false);
  };

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-cinema-text-muted hover:text-white hover:bg-cinema-elevated"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500" />
          )}
          <span className="sr-only">{dict.notifications.title}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-cinema-card border-cinema-borderSoft">
        <div className="p-3 border-b border-cinema-borderSoft flex items-center justify-between">
          <h3 className="font-medium text-cinema-text-primary">{dict.notifications.title}</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-cinema-text-muted hover:text-white"
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
            <div className="p-4 text-center text-cinema-text-muted text-sm">...</div>
          ) : !hasNotifications ? (
            <div className="p-4 text-center text-cinema-text-muted text-sm">{dict.notifications.empty}</div>
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
                    onClick={() => handleNotificationClick(item.id, item.isRead)}
                    className={`flex items-start gap-3 p-3 hover:bg-cinema-elevated/50 transition-colors ${
                      !item.isRead ? 'bg-cinema-elevated/30' : ''
                    }`}
                  >
                    <div className="relative w-10 h-14 rounded overflow-hidden bg-cinema-elevated shrink-0">
                      {media.poster?.small ? (
                        <Image
                          src={media.poster.small}
                          alt={media.title}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-cinema-text-disabled text-xs">
                          —
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-cinema-text-muted">{triggerLabel}</p>
                      <p className="text-sm font-medium text-cinema-text-primary truncate">{media.title}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-cinema-borderSoft">
          <Link href={'/notifications' as Route} onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full text-sm text-cinema-text-muted hover:text-white">
              {dict.notifications.viewAll}
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
