'use client';

import { useId, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { cn, pluralize } from '@ratingo/web-core/lib';
import { BROWSE_ROUTE } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import type { LibraryActions } from '../model/library-actions';
import { useLibraryMoves } from '../model/library-moves';
import { useShelfLists, useWatchingLists } from '../model/library-queries';
import { splitWatching } from '../model/watching-sections';
import { EmptyList, ListFailure, RowsSkeleton, SectionTitle } from './list-states';
import { ShelfRows } from './shelf-list';
import { FreshEpisodeRow, NextEpisodeRow, WaitingRowItem } from './watching-rows';

function Shelf({ actions }: { actions: LibraryActions }) {
  const { dict } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const moves = useLibraryMoves();
  const { paused, dropped } = useShelfLists();
  const pausedItems = (paused.data ?? []).filter(
    (item) => !moves.isMovedOut(item.mediaItemId, 'paused'),
  );
  const droppedItems = (dropped.data ?? []).filter(
    (item) => !moves.isMovedOut(item.mediaItemId, 'dropped'),
  );
  if (pausedItems.length + droppedItems.length === 0) return null;

  return (
    <div className="mt-4">
      <Button
        variant="ghost"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onPress={() => setIsOpen((open) => !open)}
        className="min-h-tap gap-1.5 px-0 text-sm font-semibold text-muted"
      >
        {interpolate(dict.my.watching.shelf, {
          paused: pausedItems.length,
          dropped: droppedItems.length,
        })}
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </Button>
      {isOpen ? (
        <ul id={panelId} className="flex flex-col">
          <ShelfRows
            list="paused"
            items={pausedItems}
            actions={actions}
            isMovedOut={(id) => moves.isMovedOut(id, 'paused')}
          />
          <ShelfRows
            list="dropped"
            items={droppedItems}
            actions={actions}
            isMovedOut={(id) => moves.isMovedOut(id, 'dropped')}
          />
        </ul>
      ) : null}
    </div>
  );
}

export function WatchingList({ actions }: { actions: LibraryActions }) {
  const { dict, locale } = useTranslation();
  const now = useClientNow();
  const moves = useLibraryMoves();
  const freshId = useId();
  const nextId = useId();
  const waitingId = useId();
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

  const isShown = (mediaItemId: string) => !moves.isMovedOut(mediaItemId, 'watching');
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
      <p className="text-sm text-muted tabular-nums">
        {interpolate(pluralize(showCount, dict.my.watching.showCount, locale), {
          count: showCount,
        })}
      </p>
      {sections.fresh.length > 0 ? (
        <section aria-labelledby={freshId}>
          <SectionTitle id={freshId}>
            {dict.my.watching.fresh}
            <Chip size="sm" variant="soft" color="accent" className="tabular-nums">
              {sections.fresh.length}
            </Chip>
          </SectionTitle>
          <ul className="flex flex-col">
            {sections.fresh.map((row) => (
              <li key={row.title.mediaItemId}>
                <FreshEpisodeRow row={row} actions={actions} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sections.next.length > 0 ? (
        <section aria-labelledby={nextId}>
          <SectionTitle id={nextId}>{dict.my.watching.next}</SectionTitle>
          <ul className="flex flex-col">
            {sections.next.map((row) => (
              <li key={row.title.mediaItemId}>
                <NextEpisodeRow row={row} actions={actions} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sections.waiting.length > 0 ? (
        <section aria-labelledby={waitingId}>
          <SectionTitle id={waitingId}>{dict.my.watching.waiting}</SectionTitle>
          <ul className="flex flex-col">
            {sections.waiting.map((row) => (
              <li key={row.title.mediaItemId}>
                <WaitingRowItem row={row} actions={actions} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Shelf actions={actions} />
    </div>
  );
}
