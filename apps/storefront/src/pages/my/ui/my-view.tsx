'use client';

import { useState } from 'react';
import { Skeleton } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import {
  LIBRARY_LISTS,
  listCount,
  useLibraryCounts,
  type MainLibraryList,
} from '@/entities/library';
import { LibraryShell } from '@/widgets/library-nav';
import { NotificationBell, ProfileMenu } from '@/widgets/header';
import type { LibraryCounts } from '@/shared/api';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { cn, pluralize } from '@ratingo/web-core/lib';
import { PageHeader, SECTION_TITLE_DESKTOP, STICKY_TOOLBAR } from '@/shared/ui';
import { PullToRefresh } from '@/shared/ui/gestures';
import { useLibraryActions, type LibraryActions } from '../model/library-actions';
import { LibraryMovesProvider } from '../model/library-moves';
import type { MyRoute } from '../model/my-route';
import { HistoryList } from './history-list';
import { ListChips } from './list-chips';
import { ChipsSkeleton, LibraryListSkeleton } from './list-states';
import { NewUserStart } from './new-user-start';
import { PlanList } from './plan-list';
import { WatchingList } from './watching-list';

function isEmptyLibrary(counts: LibraryCounts): boolean {
  return LIBRARY_LISTS.every((list) => listCount(counts, list) === 0);
}

function useStartsEmpty(counts: LibraryCounts | undefined): boolean | undefined {
  const [startsEmpty, setStartsEmpty] = useState<boolean>();
  if (counts && startsEmpty === undefined) setStartsEmpty(isEmptyLibrary(counts));
  return startsEmpty;
}

const PHONE_ACTIONS = 'flex items-center gap-1 md:hidden';

function PhoneHeaderActions() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div aria-hidden className={PHONE_ACTIONS}>
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="size-11 rounded-full" />
      </div>
    );
  }
  if (!user) return null;
  return (
    <div className={PHONE_ACTIONS}>
      <NotificationBell />
      <ProfileMenu user={user} />
    </div>
  );
}

function PhoneHeader() {
  const { dict } = useTranslation();

  return (
    <PageHeader title={dict.nav.my} className="md:sr-only" actions={<PhoneHeaderActions />} />
  );
}

function SelectedList({ list, watchingFilter, actions }: MyRoute & { actions: LibraryActions }) {
  if (list === 'plan') return <PlanList actions={actions} />;
  if (list === 'history') return <HistoryList actions={actions} />;
  return <WatchingList key={watchingFilter} actions={actions} initialFilter={watchingFilter} />;
}

type PluralForms = Dictionary['my']['titleCount'];

const COUNT_FORMS: Record<MainLibraryList, (dict: Dictionary) => PluralForms> = {
  watching: (dict) => dict.my.watching.showCount,
  plan: (dict) => dict.my.titleCount,
  history: (dict) => dict.my.history.summary,
};

function ListHeader({ list }: { list: MainLibraryList }) {
  const { dict, locale } = useTranslation();
  const counts = useLibraryCounts();
  const count = counts ? listCount(counts, list) : undefined;

  return (
    <div className="max-md:sr-only md:sticky md:top-16 md:z-20 md:flex md:min-h-11 md:items-center md:pb-4 md:box-content md:gap-3 md:border-b md:border-separator md:bg-background">
      <h2 className={cn('font-extrabold', SECTION_TITLE_DESKTOP)}>{dict.my.lists[list]}</h2>
      {count === undefined ? null : (
        <>
          <span aria-hidden className="h-6 w-px bg-separator" />
          <span className="text-sm text-muted tabular-nums">
            {interpolate(pluralize(count, COUNT_FORMS[list](dict), locale), { count })}
          </span>
        </>
      )}
    </div>
  );
}

function Library({ list, watchingFilter }: MyRoute) {
  const actions = useLibraryActions();
  const startsEmpty = useStartsEmpty(useLibraryCounts());

  if (startsEmpty) return <NewUserStart actions={actions} />;

  return (
    <PullToRefresh fillsHeight onRefresh={actions.refresh}>
      <div className="flex flex-1 flex-col gap-3">
        <div className={cn(STICKY_TOOLBAR, 'md:hidden')}>
          <ListChips current={list} />
        </div>
        <ListHeader list={list} />
        <SelectedList list={list} watchingFilter={watchingFilter} actions={actions} />
      </div>
    </PullToRefresh>
  );
}

export function MyView({ list, watchingFilter }: MyRoute) {
  return (
    <LibraryShell
      current={list}
      header={<PhoneHeader />}
      skeleton={
        <div className="flex flex-col gap-3">
          <ChipsSkeleton />
          <ListHeader list={list} />
          <LibraryListSkeleton list={list} />
        </div>
      }
    >
      <LibraryMovesProvider>
        <Library list={list} watchingFilter={watchingFilter} />
      </LibraryMovesProvider>
    </LibraryShell>
  );
}
