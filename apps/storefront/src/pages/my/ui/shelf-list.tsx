'use client';

import { Button } from '@heroui/react';
import type { UserMediaState } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { LibraryActions } from '../model/library-actions';
import { useShelfLists } from '../model/library-queries';
import { titleOf } from '../model/library-title';
import { LibraryRow } from './library-row';
import { ListFailure, RowsSkeleton } from './list-states';

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
  const lists = useShelfLists();
  const query = lists[list];

  if (query.isPending) return <RowsSkeleton />;
  if (query.isError) return <ListFailure onRetry={() => void query.refetch()} />;
  return (
    <ul className="flex flex-col">
      <ShelfRows list={list} items={query.data} actions={actions} isMovedOut={isMovedOut} />
    </ul>
  );
}
