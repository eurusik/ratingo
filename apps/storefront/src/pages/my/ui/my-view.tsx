'use client';

import { useState } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { LIBRARY_LISTS, listCount, useLibraryCounts, type LibraryList } from '@/entities/library';
import { LibraryShell } from '@/widgets/library-nav';
import { NotificationBell, ProfileMenu } from '@/widgets/header';
import type { LibraryCounts } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { PageHeader } from '@/shared/ui';
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
      titleClassName="md:sr-only"
      className="md:contents"
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

function Library({ list }: { list: LibraryList }) {
  const { dict } = useTranslation();
  const actions = useLibraryActions();
  const startsEmpty = useStartsEmpty(useLibraryCounts());

  if (startsEmpty) return <NewUserStart actions={actions} />;

  return (
    <PullToRefresh onRefresh={actions.refresh}>
      <div className="flex flex-col gap-3">
        <div className="md:hidden">
          <ListChips current={list} />
        </div>
        <h2 className="sr-only text-2xl font-extrabold md:not-sr-only md:flex md:min-h-11 md:items-center">
          {dict.my.lists[list]}
        </h2>
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
