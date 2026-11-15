'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Skeleton, buttonVariants } from '@heroui/react';
import { Check, ChevronLeft, Settings } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import { cn } from '@ratingo/web-core/lib';
import {
  groupByAge,
  useMarkNotificationRead,
  useNotificationPages,
  useReadAllNotifications,
  useUnreadNotificationCount,
  type NotificationFilter,
} from '@/entities/notification';
import { LibraryNav } from '@/widgets/library-nav';
import { MY_ROUTE, NOTIFICATION_SETTINGS_ROUTE } from '@/shared/config';
import { openAuth } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import { BackLink, SegmentedFilter } from '@/shared/ui';
import { PullToRefresh } from '@/shared/ui/gestures';
import { NotificationListItem } from './notification-item';

const SKELETON_ROWS = 4;

function ListSkeleton() {
  const { dict } = useTranslation();
  return (
    <ul aria-busy aria-label={dict.common.loading} className="flex flex-col gap-2">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li key={index} className="flex items-center gap-3 rounded-2xl p-3">
          <Skeleton className="h-18 w-12 shrink-0 rounded-[9px]" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function AllRead() {
  const { dict } = useTranslation();
  return (
    <div
      role="status"
      className="mx-auto flex max-w-sm flex-col items-center gap-2 py-10 text-center"
    >
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success"
      >
        <Check className="size-8" strokeWidth={2.4} />
      </span>
      <p className="mt-2 text-lg font-extrabold">{dict.notifications.allCaughtUp.title}</p>
      <p className="text-sm text-muted">{dict.notifications.allCaughtUp.text}</p>
    </div>
  );
}

function NotificationList({ filter }: { filter: NotificationFilter }) {
  const { dict } = useTranslation();
  const now = useClientNow();
  const pages = useNotificationPages(filter);
  const markRead = useMarkNotificationRead();

  if (pages.isPending) return <ListSkeleton />;
  if (pages.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-muted">{dict.notifications.failed}</p>
        <Button variant="secondary" onPress={() => void pages.refetch()}>
          {dict.my.retry}
        </Button>
      </div>
    );
  }

  const items = pages.data.pages
    .flatMap((page) => page.data)
    .filter((item) => filter === 'all' || !item.isRead);
  if (items.length === 0) {
    return filter === 'unread' ? (
      <AllRead />
    ) : (
      <p role="status" className="py-10 text-center text-muted">
        {dict.notifications.empty}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groupByAge(items, now).map(({ group, items: groupItems }) => (
        <section key={group} aria-labelledby={`notifications-${group}`}>
          <h2 id={`notifications-${group}`} className="mb-1.5 text-sm font-bold text-muted">
            {dict.notifications.groups[group]}
          </h2>
          <ul className="flex flex-col gap-2 md:gap-1.5">
            {groupItems.map((item) => (
              <li key={item.id}>
                <NotificationListItem item={item} now={now} onOpen={markRead} onRead={markRead} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {pages.hasNextPage ? (
        <Button
          variant="secondary"
          isPending={pages.isFetchingNextPage}
          onPress={() => void pages.fetchNextPage()}
          className="self-center"
        >
          {dict.notifications.loadMore}
        </Button>
      ) : null}
    </div>
  );
}

function Notifications() {
  const { dict } = useTranslation();
  const [filter, setFilter] = useState<NotificationFilter>('unread');
  const unreadCount = useUnreadNotificationCount();
  const readAll = useReadAllNotifications();
  const pages = useNotificationPages(filter);
  const readAllButton =
    unreadCount > 0 ? (
      <Button
        variant="ghost"
        className="min-h-tap px-1 text-accent md:px-3"
        onPress={() => readAll(unreadCount)}
      >
        {dict.notifications.markAllRead}
      </Button>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-14 items-center gap-2">
        <BackLink
          fallbackHref={MY_ROUTE}
          aria-label={dict.notifications.back}
          className="-ms-2 inline-flex size-11 items-center justify-center rounded-full text-foreground md:hidden"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </BackLink>
        <h1 className="flex-1 text-[22px] font-extrabold md:text-2xl">
          {dict.notifications.title}
        </h1>
        {readAllButton}
        <Link
          href={NOTIFICATION_SETTINGS_ROUTE}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'hidden rounded-full no-underline md:inline-flex',
          )}
        >
          {dict.notifications.settingsShort}
        </Link>
      </div>
      <SegmentedFilter
        label={dict.notifications.filterLabel}
        options={[
          {
            id: 'unread',
            label:
              unreadCount > 0
                ? interpolate(dict.notifications.unreadFilter, { count: unreadCount })
                : dict.notifications.filter.unread,
          },
          { id: 'all', label: dict.notifications.filter.all },
        ]}
        value={filter}
        onChange={setFilter}
        className="px-0"
      />
      <PullToRefresh onRefresh={() => pages.refetch()}>
        <NotificationList filter={filter} />
      </PullToRefresh>
      <p className="pt-3 text-center text-[13px] text-muted md:text-start">
        {dict.notifications.footnote}
      </p>
      <Link
        href={NOTIFICATION_SETTINGS_ROUTE}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-surface text-sm font-semibold text-foreground/85 no-underline outline-none focus-visible:outline-2 focus-visible:outline-focus md:hidden"
      >
        <Settings aria-hidden className="size-4" />
        {dict.notifications.settings}
      </Link>
    </div>
  );
}

export function NotificationsView() {
  const { dict } = useTranslation();
  const { user, isLoading } = useAuth();

  const content = (() => {
    if (isLoading) return <ListSkeleton />;
    if (!user) {
      return (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-extrabold">{dict.my.signIn.title}</p>
          <Button className="mt-3" onPress={() => openAuth()}>
            {dict.my.signIn.action}
          </Button>
        </div>
      );
    }
    return <Notifications />;
  })();

  return (
    <div className="flex flex-col gap-3 px-4 md:flex-row md:items-start md:gap-10 md:px-0 md:pt-7">
      {user ? (
        <div className="hidden md:block">
          <LibraryNav current="notifications" />
        </div>
      ) : null}
      <div className="min-w-0 max-w-[860px] flex-1">{content}</div>
    </div>
  );
}
