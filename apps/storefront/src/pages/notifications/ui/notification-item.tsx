'use client';

import { Button } from '@heroui/react';
import { Check } from 'lucide-react';
import { NotificationRow } from '@/entities/notification';
import type { NotificationItem } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { SwipeableRow } from '@/shared/ui/gestures';

const HOVER_REVEAL =
  'transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/notification:opacity-100 [@media(hover:hover)]:group-focus-within/notification:opacity-100';

interface NotificationItemProps {
  item: NotificationItem;
  now: number;
  onOpen: (item: NotificationItem) => void;
  onRead: (item: NotificationItem) => void;
}

export function NotificationListItem({ item, now, onOpen, onRead }: NotificationItemProps) {
  const { dict } = useTranslation();
  const row = (
    <NotificationRow
      item={item}
      now={now}
      onOpen={onOpen}
      actions={
        item.isRead ? null : (
          <Button
            isIconOnly
            variant="outline"
            aria-label={dict.notifications.markRead}
            onPress={() => onRead(item)}
            className={`hidden size-9 shrink-0 rounded-full md:inline-flex ${HOVER_REVEAL}`}
          >
            <Check aria-hidden className="size-4" strokeWidth={2.4} />
          </Button>
        )
      }
    />
  );

  if (item.isRead) return row;

  return (
    <SwipeableRow
      className="rounded-2xl [--swipeable-row-surface:transparent]"
      actions={
        <Button
          excludeFromTabOrder
          variant="primary"
          onPress={() => onRead(item)}
          className="h-full min-h-tap rounded-none px-6 text-[13px] font-bold"
        >
          {dict.notifications.read}
        </Button>
      }
    >
      {row}
    </SwipeableRow>
  );
}
