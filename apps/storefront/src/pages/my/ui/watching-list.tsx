'use client';

import { useId, useState } from 'react';
import { Chip } from '@heroui/react';
import type { UserMediaState } from '@/shared/api';
import { BROWSE_ROUTE } from '@/shared/config';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import { EmptyState, SegmentedFilter, ShowMore } from '@/shared/ui';
import type { LibraryActions } from '../model/library-actions';
import { useIsMovedOut } from '../model/library-moves';
import { useShelfLists, useWatchingLists } from '../model/library-queries';
import { titleOf } from '../model/library-title';
import { useRevealedRows } from '../model/revealed-rows';
import { isSearchQuery } from '../model/title-search';
import {
  WATCHING_FILTERS,
  filterCounts,
  firstFilledFilter,
  groupByKind,
  visibleWatchingItems,
  watchingItems,
  type ShelfRow,
  type WatchingFilter,
  type WatchingGroup,
  type WatchingItem,
  type WatchingKind,
} from '../model/watching-filters';
import { splitWatching } from '../model/watching-sections';
import { ListSearch } from './list-search';
import { EmptyList, LibraryListSkeleton, ListFailure, SectionTitle } from './list-states';
import { ShelfRowItem } from './shelf-list';
import { FreshEpisodeRow, NextEpisodeRow, WaitingRowItem } from './watching-rows';

const GROUP_TITLE: Record<WatchingKind, (dict: Dictionary) => string> = {
  fresh: (dict) => dict.my.watching.fresh,
  next: (dict) => dict.my.watching.next,
  waiting: (dict) => dict.my.watching.waiting,
  paused: (dict) => dict.my.lists.paused,
  dropped: (dict) => dict.my.lists.dropped,
};

function shelfRows(kind: ShelfRow['kind'], items: readonly UserMediaState[]): ShelfRow[] {
  return items.flatMap((item) =>
    item.mediaSummary ? [{ kind, title: titleOf(item.mediaItemId, item.mediaSummary) }] : [],
  );
}

function useWatchingItems() {
  const now = useClientNow();
  const isMovedOut = useIsMovedOut();
  const { watching, caughtUp, recent } = useWatchingLists();
  const { paused, dropped } = useShelfLists();
  const required = [watching, caughtUp, paused, dropped];
  const isShownIn = (list: 'watching' | 'paused' | 'dropped') => (item: UserMediaState) =>
    !isMovedOut(item.mediaItemId, list);

  const sections = splitWatching(
    (watching.data ?? []).filter(isShownIn('watching')),
    (caughtUp.data ?? []).filter(isShownIn('watching')),
    recent.data,
    now,
  );
  const items = watchingItems(sections, {
    paused: shelfRows('paused', (paused.data ?? []).filter(isShownIn('paused'))),
    dropped: shelfRows('dropped', (dropped.data ?? []).filter(isShownIn('dropped'))),
  });

  return {
    now,
    items,
    isPending: required.some((query) => query.isPending),
    isError: required.some((query) => query.isError),
    retry: () => required.forEach((query) => void query.refetch()),
  };
}

interface ItemProps {
  item: WatchingItem;
  actions: LibraryActions;
  now: number;
}

function WatchingRow({ item, actions, now }: ItemProps) {
  if (item.kind === 'fresh') return <FreshEpisodeRow row={item} actions={actions} now={now} />;
  if (item.kind === 'next') return <NextEpisodeRow row={item} actions={actions} />;
  if (item.kind === 'waiting') return <WaitingRowItem row={item} actions={actions} now={now} />;
  return <ShelfRowItem row={item} actions={actions} />;
}

interface GroupProps {
  group: WatchingGroup;
  hasTitle: boolean;
  listLabel: string;
  freshCount: number;
  actions: LibraryActions;
  now: number;
}

function Group({ group, hasTitle, listLabel, freshCount, actions, now }: GroupProps) {
  const { dict } = useTranslation();
  const headingId = useId();
  const rows = (
    <ul
      aria-labelledby={hasTitle ? headingId : undefined}
      aria-label={hasTitle ? undefined : listLabel}
      className="flex flex-col"
    >
      {group.rows.map((item) => (
        <li key={`${item.kind}:${item.title.mediaItemId}`}>
          <WatchingRow item={item} actions={actions} now={now} />
        </li>
      ))}
    </ul>
  );
  if (!hasTitle) return rows;

  return (
    <section aria-labelledby={headingId}>
      <SectionTitle id={headingId}>
        {GROUP_TITLE[group.kind](dict)}
        {group.kind === 'fresh' ? (
          <Chip size="sm" variant="soft" color="accent" className="tabular-nums">
            {freshCount}
          </Chip>
        ) : null}
      </SectionTitle>
      {rows}
    </section>
  );
}

function NoRows({ filter, query }: { filter: WatchingFilter; query: string }) {
  const { dict } = useTranslation();
  if (isSearchQuery(query)) {
    return (
      <EmptyState
        title={interpolate(dict.my.search.noMatches, { query })}
        text={dict.my.search.noMatchesAnywhereText}
      />
    );
  }
  return <EmptyState {...dict.my.watching.filterEmpty[filter]} />;
}

interface WatchingListProps {
  actions: LibraryActions;
  initialFilter?: WatchingFilter;
}

export function WatchingList({ actions, initialFilter }: WatchingListProps) {
  const { dict } = useTranslation();
  const [query, setQuery] = useState('');
  const [chosenFilter, setChosenFilter] = useState(initialFilter);
  const { now, items, isPending, isError, retry } = useWatchingItems();
  const counts = filterCounts(items);
  const filter = chosenFilter ?? firstFilledFilter(counts);
  const isSearching = isSearchQuery(query);
  const resetKey = `${filter}:${query}`;
  const visible = visibleWatchingItems(items, { filter, query });
  const reveal = useRevealedRows(visible, resetKey);

  if (isPending) return <LibraryListSkeleton list="watching" />;
  if (isError) return <ListFailure onRetry={retry} />;
  if (items.length === 0) return <EmptyList {...dict.my.watching.empty} href={BROWSE_ROUTE} />;

  const freshCount = visible.filter((item) => item.kind === 'fresh').length;
  const groups = groupByKind(reveal.shown);
  const hasTitles = isSearching || filter !== 'waiting';

  return (
    <div className="flex flex-1 flex-col gap-3">
      <ListSearch
        label={dict.my.watching.searchLabel}
        placeholder={dict.my.watching.search}
        value={query}
        onChange={setQuery}
      />
      <SegmentedFilter
        label={dict.my.watching.filterLabel}
        options={WATCHING_FILTERS.filter((id) => counts[id] > 0 || id === filter).map((id) => ({
          id,
          label: dict.my.watching.filter[id],
          count: counts[id],
        }))}
        value={filter}
        onChange={setChosenFilter}
        isDisabled={isSearching}
        isScrollable
      />
      {groups.length === 0 ? (
        <NoRows filter={filter} query={query} />
      ) : (
        <div className="flex flex-col">
          {groups.map((group) => (
            <Group
              key={group.kind}
              group={group}
              hasTitle={hasTitles}
              listLabel={dict.my.watching.filter[filter]}
              freshCount={freshCount}
              actions={actions}
              now={now}
            />
          ))}
        </div>
      )}
      <ShowMore
        key={resetKey}
        hasMore={reveal.hasMore}
        label={dict.my.loadMore}
        loadingLabel={dict.common.loading}
        rearmKey={reveal.shownCount}
        onMore={reveal.showMore}
      />
    </div>
  );
}
