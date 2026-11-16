'use client';

import { useId, useState, type ReactNode } from 'react';
import { Button, Chip } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { cn, pluralize } from '@ratingo/web-core/lib';
import { BROWSE_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import type { LibraryActions } from '../model/library-actions';
import { useIsMovedOut } from '../model/library-moves';
import { useShelfLists, useWatchingLists } from '../model/library-queries';
import { splitWatching } from '../model/watching-sections';
import { EmptyList, ListFailure, RowsSkeleton, SectionTitle } from './list-states';
import { ShelfRows } from './shelf-list';
import { FreshEpisodeRow, NextEpisodeRow, WaitingRowItem } from './watching-rows';

function Shelf({ actions }: { actions: LibraryActions }) {
  const { dict } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const isMovedOut = useIsMovedOut();
  const { paused, dropped } = useShelfLists();
  const pausedItems = (paused.data ?? []).filter((item) => !isMovedOut(item.mediaItemId, 'paused'));
  const droppedItems = (dropped.data ?? []).filter(
    (item) => !isMovedOut(item.mediaItemId, 'dropped'),
  );
  if (pausedItems.length + droppedItems.length === 0) return null;

  return (
    <div className="mt-4">
      <Button
        size="sm"
        variant="outline"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onPress={() => setIsOpen((open) => !open)}
        className="min-h-tap gap-1.5 rounded-full px-4 text-muted"
      >
        {[
          { label: dict.my.lists.paused, count: pausedItems.length },
          { label: dict.my.lists.dropped, count: droppedItems.length },
        ]
          .filter(({ count }) => count > 0)
          .map(({ label, count }) => interpolate(dict.my.watching.shelfPart, { label, count }))
          .join(' · ')}
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </Button>
      <ul id={panelId} hidden={!isOpen} className="flex flex-col">
        <ShelfRows
          list="paused"
          items={pausedItems}
          actions={actions}
          isMovedOut={(id) => isMovedOut(id, 'paused')}
        />
        <ShelfRows
          list="dropped"
          items={droppedItems}
          actions={actions}
          isMovedOut={(id) => isMovedOut(id, 'dropped')}
        />
      </ul>
    </div>
  );
}

interface WatchingSectionProps<T extends { title: { mediaItemId: string } }> {
  title: string;
  badge?: number;
  rows: readonly T[];
  renderRow: (row: T) => ReactNode;
}

function WatchingSection<T extends { title: { mediaItemId: string } }>({
  title,
  badge,
  rows,
  renderRow,
}: WatchingSectionProps<T>) {
  const headingId = useId();
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <SectionTitle id={headingId}>
        {title}
        {badge === undefined ? null : (
          <Chip size="sm" variant="soft" color="accent" className="tabular-nums">
            {badge}
          </Chip>
        )}
      </SectionTitle>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.title.mediaItemId}>{renderRow(row)}</li>
        ))}
      </ul>
    </section>
  );
}

export function WatchingList({ actions }: { actions: LibraryActions }) {
  const { dict, locale } = useTranslation();
  const now = useClientNow();
  const isMovedOut = useIsMovedOut();
  const { watching, caughtUp, recent } = useWatchingLists();

  if (watching.isPending || caughtUp.isPending) return <RowsSkeleton />;
  if (watching.isError || caughtUp.isError) {
    return (
      <ListFailure
        onRetry={() => {
          void watching.refetch();
          void caughtUp.refetch();
        }}
      />
    );
  }

  const isShown = (mediaItemId: string) => !isMovedOut(mediaItemId, 'watching');
  const sections = splitWatching(
    watching.data.filter((item) => isShown(item.mediaItemId)),
    caughtUp.data.filter((item) => isShown(item.mediaItemId)),
    recent.data,
    now,
  );
  const showCount = sections.fresh.length + sections.next.length + sections.waiting.length;

  if (showCount === 0) {
    return (
      <>
        <EmptyList {...dict.my.watching.empty} href={BROWSE_ROUTE} />
        <Shelf actions={actions} />
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="text-sm text-muted tabular-nums md:hidden">
        {interpolate(pluralize(showCount, dict.my.watching.showCount, locale), {
          count: showCount,
        })}
      </p>
      <WatchingSection
        title={dict.my.watching.fresh}
        badge={sections.fresh.length}
        rows={sections.fresh}
        renderRow={(row) => <FreshEpisodeRow row={row} actions={actions} now={now} />}
      />
      <WatchingSection
        title={dict.my.watching.next}
        rows={sections.next}
        renderRow={(row) => <NextEpisodeRow row={row} actions={actions} />}
      />
      <WatchingSection
        title={dict.my.watching.waiting}
        rows={sections.waiting}
        renderRow={(row) => <WaitingRowItem row={row} actions={actions} now={now} />}
      />
      <Shelf actions={actions} />
    </div>
  );
}
