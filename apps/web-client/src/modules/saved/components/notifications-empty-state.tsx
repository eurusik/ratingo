/**
 * Empty state for the notifications page.
 * Two variants: all notifications read, or no notifications at all.
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Bell, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';

interface NotificationsEmptyStateProps {
  variant: 'all-read' | 'no-notifications';
}

export function NotificationsEmptyState({ variant }: NotificationsEmptyStateProps) {
  const { dict } = useTranslation();

  const isAllRead = variant === 'all-read';
  const Icon = isAllRead ? CheckCircle : Bell;
  const title = isAllRead
    ? dict.notifications.emptyState.allRead
    : dict.notifications.emptyState.noNotifications;
  const description = isAllRead
    ? dict.notifications.emptyState.allReadDescription
    : dict.notifications.emptyState.noNotificationsDescription;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center min-h-[300px]">
      <div className="w-20 h-20 rounded-full bg-cinema-elevated/30 border border-cinema-border/50 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-cinema-text-muted" />
      </div>
      <h3 className="text-xl font-medium text-cinema-text-primary mb-3">{title}</h3>
      <p className="text-base text-cinema-text-muted max-w-md leading-relaxed">{description}</p>

      {variant === 'all-read' && (
        <Button asChild variant="ghost" className="mt-4 text-cinema-text-muted">
          <Link href={'/shows' as Route}>{dict.notifications.emptyState.browseShows}</Link>
        </Button>
      )}

      {variant === 'no-notifications' && (
        <div className="flex gap-3 mt-4">
          <Button asChild variant="outline">
            <Link href={'/shows' as Route}>{dict.notifications.emptyState.browseShows}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={'/movies' as Route}>{dict.notifications.emptyState.browseMovies}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
