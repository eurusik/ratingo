'use client';

import { Button } from '@heroui/react';
import { Play, Undo2 } from 'lucide-react';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { LibraryActions } from '../model/library-actions';
import type { ShelfRow } from '../model/watching-filters';
import { LibraryRow } from './library-row';
import { RowMenu, type RowMenuItem } from './row-menu';

export function ShelfRowItem({ row, actions }: { row: ShelfRow; actions: LibraryActions }) {
  const { dict } = useTranslation();
  const { title } = row;
  const isPaused = row.kind === 'paused';
  const ReturnIcon = isPaused ? Play : Undo2;
  const returnLabel = isPaused ? dict.my.watching.resume : dict.my.watching.restore;
  const returnToWatching = () => actions.restore(title, row.kind);
  const meta = [dict.media.type[title.type], title.year].filter(Boolean).join(' · ');
  const menuItems: RowMenuItem[] = [
    { id: 'return', label: returnLabel, onAction: returnToWatching },
    ...(isPaused
      ? [
          {
            id: 'drop',
            label: dict.my.actions.drop,
            isDanger: true,
            onAction: () => actions.dropPaused(title),
          },
        ]
      : []),
    { id: 'open', label: dict.my.actions.open, href: mediaRoute(title.type, title.slug) },
  ];

  return (
    <LibraryRow
      title={title}
      meta={meta}
      action={
        <Button
          variant="secondary"
          aria-label={interpolate(
            isPaused ? dict.my.watching.resumeLabel : dict.my.watching.restoreLabel,
            { title: title.title },
          )}
          onPress={returnToWatching}
          className="size-11 shrink-0 gap-2 rounded-full p-0 font-bold md:w-auto md:px-4"
        >
          <ReturnIcon aria-hidden className="size-4.5" />
          <span className="max-md:sr-only">{returnLabel}</span>
        </Button>
      }
      menu={
        <RowMenu
          label={interpolate(dict.my.actions.more, { title: title.title })}
          items={menuItems}
        />
      }
    />
  );
}
