'use client';

import { useState } from 'react';
import { Badge, Button, Popover } from '@heroui/react';
import { Bell } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '@/shared/lib';
import { Sheet } from '@/shared/ui';
import { useLatestNotifications } from '../model/notifications';
import { NotificationPanel } from './notification-panel';

export function NotificationBell() {
  const { dict } = useTranslation();
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const [isOpen, setIsOpen] = useState(false);
  const { data } = useLatestNotifications();
  const unreadCount = data?.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  const close = () => setIsOpen(false);

  const trigger = (
    <Button
      isIconOnly
      variant="ghost"
      className="size-11 rounded-full"
      aria-label={
        hasUnread
          ? interpolate(dict.notifications.unread, { count: unreadCount })
          : dict.notifications.title
      }
    >
      <Badge.Anchor>
        <Bell aria-hidden className="size-5" />
        {hasUnread ? <Badge color="accent" size="sm" /> : null}
      </Badge.Anchor>
    </Button>
  );

  if (!isDesktop) {
    return (
      <Sheet
        trigger={trigger}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={dict.notifications.title}
      >
        <NotificationPanel onNavigate={close} />
      </Sheet>
    );
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <Popover.Content placement="bottom end" className="w-80">
        <Popover.Dialog>
          <Popover.Heading className="text-base font-bold">
            {dict.notifications.title}
          </Popover.Heading>
          <NotificationPanel onNavigate={close} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
