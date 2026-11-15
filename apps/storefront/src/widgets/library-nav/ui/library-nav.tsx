'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Separator } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import {
  MAIN_LIBRARY_LISTS,
  SHELF_LIBRARY_LISTS,
  libraryListRoute,
  listCount,
  useLibraryCounts,
  type LibraryList,
} from '@/entities/library';
import { useUnreadNotificationCount } from '@/entities/notification';
import { NOTIFICATIONS_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';

type NavTarget = LibraryList | 'notifications';

const ITEM_CLASS =
  'flex items-center gap-2 rounded-xl px-3.5 text-foreground/85 no-underline outline-none transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-surface aria-[current=page]:font-bold aria-[current=page]:text-foreground';

interface NavItemProps {
  href: string;
  label: string;
  isCurrent: boolean;
  isMinor?: boolean;
  children?: ReactNode;
}

function NavItem({ href, label, isCurrent, isMinor = false, children }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(ITEM_CLASS, isMinor ? 'h-10 text-sm text-muted' : 'h-11 text-[15px]')}
    >
      <span className="flex-1 truncate">{label}</span>
      {children}
    </Link>
  );
}

function Count({ value }: { value: number | undefined }) {
  return (
    <span className="min-w-6 text-end text-[13px] text-muted tabular-nums">{value ?? ''}</span>
  );
}

export function LibraryNav({ current }: { current: NavTarget }) {
  const { dict } = useTranslation();
  const counts = useLibraryCounts();
  const unreadCount = useUnreadNotificationCount();
  const countOf = (list: LibraryList) => (counts ? listCount(counts, list) : undefined);

  return (
    <nav aria-label={dict.my.listsLabel} className="flex w-55 shrink-0 flex-col gap-1">
      <p className="mb-3 text-[32px] font-extrabold tracking-tight">{dict.nav.my}</p>
      {MAIN_LIBRARY_LISTS.map((list) => (
        <NavItem
          key={list}
          href={libraryListRoute(list)}
          label={dict.my.lists[list]}
          isCurrent={current === list}
        >
          <Count value={countOf(list)} />
        </NavItem>
      ))}
      <Separator className="my-2" />
      {SHELF_LIBRARY_LISTS.map((list) => (
        <NavItem
          key={list}
          href={libraryListRoute(list)}
          label={dict.my.lists[list]}
          isCurrent={current === list}
          isMinor
        >
          <Count value={countOf(list)} />
        </NavItem>
      ))}
      <Separator className="my-2" />
      <NavItem
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
      </NavItem>
    </nav>
  );
}
