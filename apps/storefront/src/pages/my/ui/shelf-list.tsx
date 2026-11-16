'use client';

import { Button } from '@heroui/react';
import type { UserMediaState } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { LibraryActions } from '../model/library-actions';
import { useShelfLists } from '../model/library-queries';
import { useRevealedRows } from '../model/revealed-rows';
import { EmptyState, ShowMore } from '@/shared/ui';
import { titleOf } from '../model/library-title';
import { LibraryRow } from './library-row';
import { LibraryListSkeleton, ListFailure } from './list-states';

type ShelfList = 'paused' | 'dropped';

interface ShelfRowsProps {
  list: ShelfList;
  items: readonly UserMediaState[];
  actions: LibraryActions;
  isMovedOut: (mediaItemId: string) => boolean;
}

export function ShelfRows({ list, items, actions, isMovedOut }: ShelfRowsProps) {
  const { dict } = useTranslation();

  return items.flatMap((item) => {
    if (!item.mediaSummary || isMovedOut(item.mediaItemId)) return [];
    const title = titleOf(item.mediaItemId, item.mediaSummary);
    return [
      <li key={item.mediaItemId}>
        <LibraryRow
          title={title}
          meta={dict.my.lists[list]}
          action={
            <Button
              size="sm"
              variant="secondary"
              aria-label={interpolate(dict.my.watching.restoreLabel, { title: title.title })}
              onPress={() => actions.restore(title, list)}
              className="phone-tap-target shrink-0 rounded-full"
            >
              {dict.my.watching.restore}
            </Button>
          }
        />
      </li>,
    ];
  });
}

interface ShelfPageProps {
  list: ShelfList;
  actions: LibraryActions;
  isMovedOut: (mediaItemId: string) => boolean;
}

export function ShelfPage({ list, actions, isMovedOut }: ShelfPageProps) {
  const { dict } = useTranslation();
  const lists = useShelfLists();
  const query = lists[list];
  const reveal = useRevealedRows(query.data ?? [], list);

  if (query.isPending) return <LibraryListSkeleton list={list} />;
  if (query.isError) return <ListFailure onRetry={() => void query.refetch()} />;
  if (reveal.shown.length === 0) {
    return <EmptyState title={dict.my.shelfEmpty[list]} text={dict.my.shelfEmpty.text} />;
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        <ShelfRows list={list} items={reveal.shown} actions={actions} isMovedOut={isMovedOut} />
      </ul>
      <ShowMore
        key={list}
        hasMore={reveal.hasMore}
        label={dict.my.loadMore}
        loadingLabel={dict.common.loading}
        rearmKey={reveal.shownCount}
        onMore={reveal.showMore}
      />
    </div>
  );
}
