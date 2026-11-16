'use client';

import { Separator } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import {
  MAIN_LIBRARY_LISTS,
  libraryListRoute,
  listCount,
  useLibraryCounts,
  type MainLibraryList,
} from '@/entities/library';
import { useUnreadNotificationCount } from '@/entities/notification';
import { NOTIFICATIONS_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { PAGE_TITLE, SideNavItem } from '@/shared/ui';

type NavTarget = MainLibraryList | 'notifications';

function Count({ value }: { value: number | undefined }) {
  return (
    <span className="min-w-6 text-end text-[13px] text-muted tabular-nums">{value ?? ''}</span>
  );
}

export function LibraryNav({ current }: { current: NavTarget }) {
  const { dict } = useTranslation();
  const counts = useLibraryCounts();
  const unreadCount = useUnreadNotificationCount();
  const countOf = (list: MainLibraryList) => (counts ? listCount(counts, list) : undefined);

  return (
    <nav aria-label={dict.my.listsLabel} className="flex w-55 shrink-0 flex-col gap-1">
      <p className={cn('mb-3 flex min-h-11 items-center', PAGE_TITLE)}>{dict.nav.my}</p>
      {MAIN_LIBRARY_LISTS.map((list) => (
        <SideNavItem
          key={list}
          href={libraryListRoute(list)}
          label={dict.my.lists[list]}
          isCurrent={current === list}
        >
          <Count value={countOf(list)} />
        </SideNavItem>
      ))}
      <Separator className="my-2" />
      <SideNavItem
        href={NOTIFICATIONS_ROUTE}
        label={dict.notifications.title}
        isCurrent={current === 'notifications'}
        isMinor
      >
        {unreadCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-extrabold text-accent-foreground tabular-nums">
            <span aria-hidden>{unreadCount}</span>
            <span className="sr-only">
              {interpolate(dict.notifications.unreadBadge, { count: unreadCount })}
            </span>
          </span>
        ) : null}
      </SideNavItem>
    </nav>
  );
}
