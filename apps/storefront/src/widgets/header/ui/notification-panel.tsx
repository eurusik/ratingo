'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button, ListBox, Spinner, buttonVariants } from '@heroui/react';
import type { NotificationItem } from '@/shared/api';
import { NOTIFICATIONS_ROUTE, mediaRoute } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import {
  useLatestNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '../model/notifications';

function NotificationRow({ item }: { item: NotificationItem }) {
  const { dict } = useTranslation();
  const media = item.mediaSummary;
  const poster = media.poster?.thumb;

  return (
    <ListBox.Item
      id={item.id}
      href={mediaRoute(media.type, media.slug)}
      textValue={media.title}
      data-unread={!item.isRead}
      className="min-h-tap gap-3 data-[unread=true]:bg-accent-soft"
    >
      {poster ? (
        <Image
          src={poster}
          alt=""
          width={36}
          height={54}
          unoptimized
          className="h-[54px] w-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span aria-hidden className="h-[54px] w-9 shrink-0 rounded-md bg-surface-secondary" />
      )}
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">{dict.notifications.events[item.trigger]}</span>
        <span className="truncate text-sm font-semibold text-foreground">{media.title}</span>
        {item.isRead ? null : (
          <span className="sr-only">{`, ${dict.notifications.unreadItem}`}</span>
        )}
      </span>
    </ListBox.Item>
  );
}

export function NotificationPanel({ onNavigate }: { onNavigate: () => void }) {
  const { dict } = useTranslation();
  const { data, isPending, isError } = useLatestNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const items = data?.data ?? [];
  const unreadIds = new Set(items.filter((item) => !item.isRead).map((item) => item.id));

  const renderEmptyState = () => {
    if (isPending)
      return <Spinner size="sm" aria-label={dict.common.loading} className="mx-auto my-6" />;
    return (
      <p role="status" className="px-2 py-6 text-center text-sm text-muted">
        {isError ? dict.notifications.failed : dict.notifications.empty}
      </p>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {data && data.unreadCount > 0 ? (
        <Button
          size="sm"
          variant="ghost"
          className="phone-tap-target self-end"
          isPending={markAllRead.isPending}
          onPress={() => markAllRead.mutate()}
        >
          {dict.notifications.markAllRead}
        </Button>
      ) : null}
      <ListBox
        aria-label={dict.notifications.title}
        selectionMode="none"
        renderEmptyState={renderEmptyState}
        onAction={(key) => {
          const id = String(key);
          if (unreadIds.has(id)) markRead.mutate(id);
          onNavigate();
        }}
      >
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} />
        ))}
      </ListBox>
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
