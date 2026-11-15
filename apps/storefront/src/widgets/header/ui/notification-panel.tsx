'use client';

import Link from 'next/link';
import { Button, Popover, Spinner, buttonVariants } from '@heroui/react';
import {
  NotificationRow,
  useLatestNotifications,
  useMarkNotificationRead,
  useReadAllNotifications,
} from '@/entities/notification';
import type { NotificationItem } from '@/shared/api';
import { NOTIFICATIONS_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';

interface NotificationPanelProps {
  unreadCount: number;
  onNavigate: () => void;
}

export function NotificationPanel({ unreadCount, onNavigate }: NotificationPanelProps) {
  const { dict } = useTranslation();
  const now = useClientNow();
  const { data, isPending, isError } = useLatestNotifications();
  const markRead = useMarkNotificationRead();
  const readAll = useReadAllNotifications();
  const items = data?.data ?? [];

  const open = (item: NotificationItem) => {
    markRead(item);
    onNavigate();
  };

  const renderBody = () => {
    if (isPending) {
      return <Spinner size="sm" aria-label={dict.common.loading} className="mx-auto my-6" />;
    }
    if (isError || items.length === 0) {
      return (
        <p role="status" className="px-2 py-6 text-center text-sm text-muted">
          {isError ? dict.notifications.failed : dict.notifications.empty}
        </p>
      );
    }
    return (
      <ul aria-label={dict.notifications.title} className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow item={item} now={now} onOpen={open} className="p-2 md:px-2" />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-tap items-center gap-2">
        <Popover.Heading className="flex-1 text-base font-bold">
          {dict.notifications.title}
        </Popover.Heading>
        {unreadCount > 0 ? (
          <Button size="sm" variant="ghost" className="text-accent" onPress={readAll}>
            {dict.notifications.markAllRead}
          </Button>
        ) : null}
      </div>
      {renderBody()}
      <Link
        href={NOTIFICATIONS_ROUTE}
        onClick={onNavigate}
        className={buttonVariants({ variant: 'secondary', fullWidth: true })}
      >
        {dict.notifications.viewAll}
      </Link>
    </div>
  );
}
