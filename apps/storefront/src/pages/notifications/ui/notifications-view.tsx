'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Skeleton, buttonVariants } from '@heroui/react';
import { ChevronLeft, Settings } from 'lucide-react';
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
import { LibraryShell } from '@/widgets/library-nav';
import { MY_ROUTE, NOTIFICATION_SETTINGS_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import {
  BackLink,
  EmptyState,
  SectionError,
  PageHeader,
  SECTION_TITLE_DESKTOP,
  STICKY_TOOLBAR,
  SegmentedFilter,
  ShowMore,
} from '@/shared/ui';
import { PullToRefresh } from '@/shared/ui/gestures';
import { SwipeableNotification } from './swipeable-notification';

const SKELETON_ROWS = 8;

function FiltersSkeleton() {
  return (
    <div className={cn(STICKY_TOOLBAR, 'flex items-center gap-2')}>
      <Skeleton className="h-11 w-36 shrink-0 rounded-full" />
      <Skeleton className="h-11 w-14 shrink-0 rounded-full" />
    </div>
  );
}

function ListSkeleton() {
  const { dict } = useTranslation();
  return (
    <div role="status" aria-busy className="flex flex-col gap-1.5">
      <span className="sr-only">{dict.common.loading}</span>
      <Skeleton className="h-5 w-24 rounded-md" />
      <ul className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li
            key={index}
            className="flex min-h-24 items-center gap-3 rounded-2xl bg-surface p-3 md:gap-4 md:px-4"
          >
            <Skeleton className="h-18 w-12 shrink-0 rounded-[9px]" />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-4/5 rounded-md" />
              <Skeleton className="h-3.5 w-2/5 rounded-md" />
            </span>
            <Skeleton className="size-11 shrink-0 rounded-full [@media(hover:hover)]:hidden" />
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AllRead() {
  const { dict } = useTranslation();
  return (
    <EmptyState
      title={dict.notifications.allCaughtUp.title}
      text={dict.notifications.allCaughtUp.text}
    />
  );
}

type NotificationPages = ReturnType<typeof useNotificationPages>;

function NotificationList({
  filter,
  pages,
}: {
  filter: NotificationFilter;
  pages: NotificationPages;
}) {
  const { dict } = useTranslation();
  const now = useClientNow();
  const markRead = useMarkNotificationRead();

  if (pages.isPending) return <ListSkeleton />;
  if (pages.isError) {
    return (
      <div className="py-4">
        <SectionError
          title={dict.notifications.failedTitle}
          onRetry={() => void pages.refetch()}
          isRetrying={pages.isFetching}
          className="min-h-80"
        />
      </div>
    );
  }

  const items = pages.data.pages
    .flatMap((page) => page.data)
    .filter((item) => filter === 'all' || !item.isRead);
  if (items.length === 0 && !pages.hasNextPage) {
    return filter === 'unread' ? (
      <AllRead />
    ) : (
      <EmptyState title={dict.notifications.empty} text={dict.notifications.allCaughtUp.text} />
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
                <SwipeableNotification item={item} now={now} onOpen={markRead} onRead={markRead} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ShowMore
        hasMore={pages.hasNextPage}
        isLoading={pages.isFetchingNextPage}
        label={dict.notifications.loadMore}
        loadingLabel={dict.common.loading}
        rearmKey={pages.data.pages.length}
        onMore={() => void pages.fetchNextPage({ cancelRefetch: false })}
      />
    </div>
  );
}

function ReadAllButton({ className, onReadAll }: { className: string; onReadAll: () => void }) {
  const { dict } = useTranslation();

  return (
    <Button
      variant="ghost"
      className={cn('min-h-tap px-1 text-accent md:px-3', className)}
      onPress={onReadAll}
    >
      {dict.notifications.markAllRead}
    </Button>
  );
}

function NotificationsHeader() {
  const { dict } = useTranslation();
  const { user } = useAuth();
  const unreadCount = useUnreadNotificationCount();
  const readAll = useReadAllNotifications();

  return (
    <PageHeader
      title={dict.notifications.title}
      titleClassName={SECTION_TITLE_DESKTOP}
      className="md:sticky md:top-16 md:z-20 md:box-content md:pb-4 md:border-b md:border-separator md:bg-background"
      leading={
        <BackLink
          fallbackHref={MY_ROUTE}
          aria-label={dict.notifications.back}
          className="-ms-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground md:hidden"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </BackLink>
      }
      actions={
        <>
          {user && unreadCount > 0 ? (
            <ReadAllButton className="hidden md:inline-flex" onReadAll={readAll} />
          ) : null}
          {user ? (
            <Link
              href={NOTIFICATION_SETTINGS_ROUTE}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'hidden rounded-full no-underline md:inline-flex',
              )}
            >
              {dict.notifications.settingsShort}
            </Link>
          ) : null}
        </>
      }
    />
  );
}

function Notifications() {
  const { dict } = useTranslation();
  const [filter, setFilter] = useState<NotificationFilter>('unread');
  const unreadCount = useUnreadNotificationCount();
  const readAll = useReadAllNotifications();
  const pages = useNotificationPages(filter);

  return (
    <>
      <div className={cn(STICKY_TOOLBAR, 'flex items-center gap-2')}>
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
        <span className="flex-1" />
        {unreadCount > 0 ? <ReadAllButton className="md:hidden" onReadAll={readAll} /> : null}
      </div>
      <PullToRefresh fillsHeight onRefresh={() => pages.refetch()}>
        <NotificationList filter={filter} pages={pages} />
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
    </>
  );
}

export function NotificationsView() {
  return (
    <LibraryShell
      current="notifications"
      header={<NotificationsHeader />}
      skeleton={
        <>
          <FiltersSkeleton />
          <ListSkeleton />
        </>
      }
    >
      <Notifications />
    </LibraryShell>
  );
}
