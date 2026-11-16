'use client';

import { useState } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { LIBRARY_LISTS, listCount, useLibraryCounts, type LibraryList } from '@/entities/library';
import { LibraryShell } from '@/widgets/library-nav';
import { NotificationBell, ProfileMenu } from '@/widgets/header';
import type { LibraryCounts } from '@/shared/api';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { cn, pluralize } from '@ratingo/web-core/lib';
import { PageHeader, SECTION_TITLE_DESKTOP, STICKY_TOOLBAR } from '@/shared/ui';
import { PullToRefresh } from '@/shared/ui/gestures';
import { useLibraryActions, type LibraryActions } from '../model/library-actions';
import { LibraryMovesProvider, useIsMovedOut } from '../model/library-moves';
import { HistoryList } from './history-list';
import { ListChips } from './list-chips';
import { RowsSkeleton } from './list-states';
import { NewUserStart } from './new-user-start';
import { PlanList } from './plan-list';
import { ShelfPage } from './shelf-list';
import { WatchingList } from './watching-list';

function isEmptyLibrary(counts: LibraryCounts): boolean {
  return LIBRARY_LISTS.every((list) => listCount(counts, list) === 0);
}

function useStartsEmpty(counts: LibraryCounts | undefined): boolean | undefined {
  const [startsEmpty, setStartsEmpty] = useState<boolean>();
  if (counts && startsEmpty === undefined) setStartsEmpty(isEmptyLibrary(counts));
  return startsEmpty;
}

function PhoneHeader() {
  const { dict } = useTranslation();
  const { user } = useAuth();

  return (
    <PageHeader
      title={dict.nav.my}
      className="md:sr-only"
      actions={
        user ? (
          <div className="flex items-center gap-1 md:hidden">
            <NotificationBell />
            <ProfileMenu user={user} />
          </div>
        ) : null
      }
    />
  );
}

function SelectedList({ list, actions }: { list: LibraryList; actions: LibraryActions }) {
  const isMovedOut = useIsMovedOut();
  if (list === 'plan') return <PlanList actions={actions} />;
  if (list === 'history') return <HistoryList actions={actions} />;
  if (list === 'paused' || list === 'dropped') {
    return (
      <ShelfPage
        list={list}
        actions={actions}
        isMovedOut={(mediaItemId) => isMovedOut(mediaItemId, list)}
      />
    );
  }
  return <WatchingList actions={actions} />;
}

type PluralForms = Dictionary['my']['titleCount'];

const COUNT_FORMS: Record<LibraryList, (dict: Dictionary) => PluralForms> = {
  watching: (dict) => dict.my.watching.showCount,
  plan: (dict) => dict.my.titleCount,
  history: (dict) => dict.my.history.summary,
  paused: (dict) => dict.my.titleCount,
  dropped: (dict) => dict.my.titleCount,
};

function ListHeader({ list }: { list: LibraryList }) {
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

function Library({ list }: { list: LibraryList }) {
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
        <SelectedList list={list} actions={actions} />
      </div>
    </PullToRefresh>
  );
}

export function MyView({ list }: { list: LibraryList }) {
  return (
    <LibraryShell current={list} header={<PhoneHeader />} skeleton={<RowsSkeleton />}>
      <LibraryMovesProvider>
        <Library list={list} />
      </LibraryMovesProvider>
    </LibraryShell>
  );
}
