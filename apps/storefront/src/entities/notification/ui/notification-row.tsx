'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Chip } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import type { NotificationItem } from '@/shared/api';
import { mediaRoute } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { notificationDetail, notificationText, notificationTone } from '../model/notification-copy';
import { notificationTime } from '../model/notification-time';

interface NotificationRowProps {
  item: NotificationItem;
  now: number;
  onOpen: (item: NotificationItem) => void;
  actions?: ReactNode;
  className?: string;
}

function NotificationPoster({ item }: { item: NotificationItem }) {
  const poster = item.mediaSummary.poster?.small;
  if (!poster) return <span aria-hidden className="h-18 w-12 shrink-0 rounded-[9px] bg-default" />;
  return (
    <Image
      src={poster}
      alt=""
      width={48}
      height={72}
      unoptimized
      loading="lazy"
      className="h-18 w-12 shrink-0 rounded-[9px] object-cover"
    />
  );
}

export function NotificationRow({ item, now, onOpen, actions, className }: NotificationRowProps) {
  const { dict, locale } = useTranslation();
  const media = item.mediaSummary;
  const detail = notificationDetail(item, dict, locale);

  return (
    <div
      data-unread={!item.isRead}
      className={cn(
        'group/notification flex items-center gap-3 rounded-2xl bg-(--notification-surface) p-3 [--notification-surface:var(--background)] data-[unread=true]:[--notification-surface:var(--surface)] md:gap-4 md:px-4',
        className,
      )}
    >
      <NotificationPoster item={item} />
      <Link
        href={mediaRoute(media.type, media.slug)}
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg text-foreground no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex items-center gap-1.5">
          <Chip
            size="sm"
            variant="soft"
            color={notificationTone(item.trigger)}
            className="font-extrabold"
          >
            {dict.notifications.kinds[item.trigger]}
          </Chip>
          <span className="text-xs text-muted">
            {notificationTime(item.createdAt, now, locale)}
          </span>
        </span>
        <span
          className={cn(
            'text-[15px] leading-snug md:text-base',
            item.isRead ? 'font-medium' : 'font-bold',
          )}
        >
          {notificationText(item, dict)}
        </span>
        {detail ? <span className="text-[13px] text-muted md:text-sm">{detail}</span> : null}
        {item.isRead ? null : <span className="sr-only">{dict.notifications.unreadItem}</span>}
      </Link>
      {actions}
      <span
        aria-hidden
        className={cn('size-2.5 shrink-0 rounded-full', item.isRead ? 'invisible' : 'bg-accent')}
      />
    </div>
  );
}
