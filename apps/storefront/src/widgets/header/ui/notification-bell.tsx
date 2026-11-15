'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Popover } from '@heroui/react';
import { Bell } from 'lucide-react';
import { useUnreadNotificationCount } from '@/entities/notification';
import { DESKTOP_MEDIA_QUERY, NOTIFICATIONS_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useMediaQuery } from '@/shared/lib';
import { NotificationPanel } from './notification-panel';

const BELL_CLASS =
  'inline-flex size-11 items-center justify-center rounded-full text-foreground outline-none hover:bg-default focus-visible:outline-2 focus-visible:outline-focus';

function BellIcon({ unreadCount }: { unreadCount: number }) {
  return (
    <Badge.Anchor>
      <Bell aria-hidden className="size-5" />
      {unreadCount > 0 ? (
        <Badge color="accent" size="sm">
          {unreadCount}
        </Badge>
      ) : null}
    </Badge.Anchor>
  );
}

export function NotificationBell() {
  const { dict } = useTranslation();
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();
  const label =
    unreadCount > 0
      ? interpolate(dict.notifications.unread, { count: unreadCount })
      : dict.notifications.title;

  if (!isDesktop) {
    return (
      <Link href={NOTIFICATIONS_ROUTE} aria-label={label} className={BELL_CLASS}>
        <BellIcon unreadCount={unreadCount} />
      </Link>
    );
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button isIconOnly variant="ghost" className="size-11 rounded-full" aria-label={label}>
        <BellIcon unreadCount={unreadCount} />
      </Button>
      <Popover.Content placement="bottom end" className="w-96">
        <Popover.Dialog>
          <NotificationPanel unreadCount={unreadCount} onNavigate={() => setIsOpen(false)} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
