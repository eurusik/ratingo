import type { LibraryTitle } from './library-title';
import { isSearchQuery, matchesSearch } from './title-search';
import type { FreshRow, NextRow, WaitingRow, WatchingSections } from './watching-sections';

export const WATCHING_FILTERS = ['episodes', 'waiting', 'postponed'] as const;
export type WatchingFilter = (typeof WATCHING_FILTERS)[number];

export interface ShelfRow {
  kind: 'paused' | 'dropped';
  title: LibraryTitle;
}

export type WatchingItem = FreshRow | NextRow | WaitingRow | ShelfRow;
export type WatchingKind = WatchingItem['kind'];

export interface WatchingGroup {
  kind: WatchingKind;
  rows: WatchingItem[];
}

const FILTER_KINDS: Record<WatchingFilter, readonly WatchingKind[]> = {
  episodes: ['fresh', 'next'],
  waiting: ['waiting'],
  postponed: ['paused', 'dropped'],
};

export function watchingItems(
  sections: WatchingSections,
  shelf: { paused: readonly ShelfRow[]; dropped: readonly ShelfRow[] },
): WatchingItem[] {
  return [
    ...sections.fresh,
    ...sections.next,
    ...sections.waiting,
    ...shelf.paused,
    ...shelf.dropped,
  ];
}

function isInFilter(item: WatchingItem, filter: WatchingFilter): boolean {
  return FILTER_KINDS[filter].includes(item.kind);
}

export function filterCounts(items: readonly WatchingItem[]): Record<WatchingFilter, number> {
  const counts: Record<WatchingFilter, number> = { episodes: 0, waiting: 0, postponed: 0 };
  for (const item of items) {
    const filter = WATCHING_FILTERS.find((candidate) => isInFilter(item, candidate));
    if (filter) counts[filter] += 1;
  }
  return counts;
}

export function firstFilledFilter(counts: Record<WatchingFilter, number>): WatchingFilter {
  return WATCHING_FILTERS.find((filter) => counts[filter] > 0) ?? WATCHING_FILTERS[0];
}

export function visibleWatchingItems(
  items: readonly WatchingItem[],
  { filter, query }: { filter: WatchingFilter; query: string },
): WatchingItem[] {
  if (isSearchQuery(query)) return items.filter((item) => matchesSearch(item.title.title, query));
  return items.filter((item) => isInFilter(item, filter));
}

export function groupByKind(items: readonly WatchingItem[]): WatchingGroup[] {
  const groups: WatchingGroup[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.kind === item.kind) last.rows.push(item);
    else groups.push({ kind: item.kind, rows: [item] });
  }
  return groups;
}
