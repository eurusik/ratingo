'use client';

import { Button } from '@heroui/react';
import { Check } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { NotificationRow } from '@/entities/notification';
import type { NotificationItem } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { SwipeableRow } from '@/shared/ui/gestures';

const HOVER_REVEAL =
  'transition-opacity motion-reduce:transition-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/notification:opacity-100 [@media(hover:hover)]:group-focus-within/notification:opacity-100';

interface SwipeableNotificationProps {
  item: NotificationItem;
  now: number;
  onOpen: (item: NotificationItem) => void;
  onRead: (item: NotificationItem) => void;
}

export function SwipeableNotification({ item, now, onOpen, onRead }: SwipeableNotificationProps) {
  const { dict } = useTranslation();
  const label = interpolate(dict.notifications.markReadLabel, { title: item.mediaSummary.title });

  return (
    <SwipeableRow
      className="rounded-2xl [--swipeable-row-surface:transparent]"
      actions={
        item.isRead ? null : (
          <Button
            excludeFromTabOrder
            variant="primary"
            aria-label={label}
            onPress={() => onRead(item)}
            className="h-full min-h-tap rounded-none px-6 text-[13px] font-bold"
          >
            {dict.notifications.read}
          </Button>
        )
      }
    >
      <NotificationRow
        item={item}
        now={now}
        onOpen={onOpen}
        actions={
          item.isRead ? null : (
            <Button
              isIconOnly
              variant="outline"
              aria-label={label}
              onPress={() => onRead(item)}
              className={cn('size-11 shrink-0 rounded-full', HOVER_REVEAL)}
            >
              <Check aria-hidden className="size-4" strokeWidth={2.4} />
            </Button>
          )
        }
      />
    </SwipeableRow>
  );
}
