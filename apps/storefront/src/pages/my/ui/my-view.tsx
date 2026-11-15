'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { useAuth, type MeDto } from '@ratingo/web-core/auth';
import { LIBRARY_LISTS, listCount, useLibraryCounts, type LibraryList } from '@/entities/library';
import { LibraryNav } from '@/widgets/library-nav';
import { NotificationBell, ProfileMenu } from '@/widgets/header';
import type { LibraryCounts } from '@/shared/api';
import { openAuth } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { PullToRefresh } from '@/shared/ui/gestures';
import { useLibraryActions, type LibraryActions } from '../model/library-actions';
import { LibraryMovesProvider, useLibraryMoves } from '../model/library-moves';
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

function PhoneHeader({ user }: { user: MeDto | null }) {
  const { dict } = useTranslation();

  return (
    <div className="flex min-h-14 items-center gap-2 md:contents">
      <h1 className="flex-1 text-[32px] font-extrabold tracking-tight md:sr-only">{dict.nav.my}</h1>
      {user ? (
        <div className="flex items-center gap-1 md:hidden">
          <NotificationBell />
          <ProfileMenu user={user} />
        </div>
      ) : null}
    </div>
  );
}

function SignInPrompt() {
  const { dict } = useTranslation();

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-16 text-center">
      <p className="text-lg font-extrabold">{dict.my.signIn.title}</p>
      <p className="text-sm text-muted">{dict.my.signIn.text}</p>
      <Button className="mt-3" onPress={() => openAuth()}>
        {dict.my.signIn.action}
      </Button>
    </div>
  );
}

function SelectedList({ list, actions }: { list: LibraryList; actions: LibraryActions }) {
  const moves = useLibraryMoves();
  if (list === 'plan') return <PlanList actions={actions} />;
  if (list === 'history') return <HistoryList actions={actions} />;
  if (list === 'paused' || list === 'dropped') {
    return (
      <ShelfPage
        list={list}
        actions={actions}
        isMovedOut={(mediaItemId) => moves.isMovedOut(mediaItemId, list)}
      />
    );
  }
  return <WatchingList actions={actions} />;
}

function Library({ list }: { list: LibraryList }) {
  const { dict } = useTranslation();
  const actions = useLibraryActions();
  const startsEmpty = useStartsEmpty(useLibraryCounts());

  if (startsEmpty === undefined) return <RowsSkeleton />;
  if (startsEmpty) return <NewUserStart actions={actions} />;

  return (
    <PullToRefresh onRefresh={actions.refresh}>
      <div className="flex flex-col gap-3">
        <div className="md:hidden">
          <ListChips current={list} />
        </div>
        <h2 className="hidden text-2xl font-extrabold md:block">{dict.my.lists[list]}</h2>
        <SelectedList list={list} actions={actions} />
      </div>
    </PullToRefresh>
  );
}

export function MyView({ list }: { list: LibraryList }) {
  const { user, isLoading } = useAuth();

  const content = (() => {
    if (isLoading) return <RowsSkeleton />;
    if (!user) return <SignInPrompt />;
    return (
      <LibraryMovesProvider>
        <Library list={list} />
      </LibraryMovesProvider>
    );
  })();

  return (
    <div className="flex flex-col gap-3 px-4 md:flex-row md:items-start md:gap-10 md:px-0 md:pt-7">
      <PhoneHeader user={user} />
      {user ? (
        <div className="hidden md:block">
          <LibraryNav current={list} />
        </div>
      ) : null}
      <div className="min-w-0 max-w-[860px] flex-1">{content}</div>
    </div>
  );
}
