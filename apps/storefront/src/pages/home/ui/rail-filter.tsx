'use client';

import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type RefObject } from 'react';
import { queryOptions, skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { track, whenIdleOnFastConnection } from '@/shared/lib';
import { SectionError, SegmentedFilter } from '@/shared/ui';
import { activeList, type RailStart } from '../model/rail-start';

const RAIL_STALE_MS = 60_000;

const lastChosenListBySection = new Map<string, string>();

function railQueryOptions<K extends string, T>(
  sectionId: string,
  list: K | undefined,
  loadList: (list: K) => Promise<T[]>,
) {
  return queryOptions({
    queryKey: ['home-rail', sectionId, list],
    queryFn: list === undefined ? skipToken : () => loadList(list),
    staleTime: RAIL_STALE_MS,
  });
}

export interface RailFilterState<K extends string, T> {
  active?: K;
  available: readonly K[];
  items?: T[];
  isLoadingList: boolean;
  loadFailed: boolean;
  isRetrying: boolean;
  retry: () => void;
  select: (next: K) => void;
  prefetchOthers: () => void;
  scrollerRef: RefObject<HTMLDivElement | null>;
  memoryKey: string;
  pagerKey: string;
}

export function useRailFilter<K extends string, T>(
  sectionId: string,
  { available, first }: RailStart<K, T>,
  loadList: (list: K) => Promise<T[]>,
): RailFilterState<K, T> {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState(
    () => lastChosenListBySection.get(sectionId) as K | undefined,
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const active = activeList(available, chosen);
  const listToFetch = active === first?.list ? undefined : active;
  const fetched = useQuery(railQueryOptions(sectionId, listToFetch, loadList));
  const items = listToFetch === undefined ? first?.items : fetched.data;
  const loadFailed = listToFetch !== undefined && fetched.isError;

  const prefetchOthers = () => {
    for (const list of available) {
      if (list === first?.list) continue;
      void queryClient.prefetchQuery(railQueryOptions(sectionId, list, loadList));
    }
  };
  const prefetchOthersOnIdle = useEffectEvent(prefetchOthers);

  useEffect(() => whenIdleOnFastConnection(() => prefetchOthersOnIdle()), []);

  const select = (next: K) => {
    lastChosenListBySection.set(sectionId, next);
    track('home_rail_change', { section: sectionId, list: next });
    setChosen(next);
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
  };

  return {
    active,
    available,
    items,
    isLoadingList: items === undefined && !loadFailed,
    loadFailed,
    isRetrying: fetched.isFetching,
    retry: () => void fetched.refetch(),
    select,
    prefetchOthers,
    scrollerRef,
    memoryKey: `${sectionId}:${active}`,
    pagerKey: `${sectionId}:${active}:${items ? 'ready' : 'waiting'}`,
  };
}

interface RailFilterBarProps<K extends string> {
  label: string;
  labels: Record<K, string>;
  available: readonly K[];
  active: K;
  onSelect: (next: K) => void;
  onIntent: () => void;
}

export function RailFilterBar<K extends string>({
  label,
  labels,
  available,
  active,
  onSelect,
  onIntent,
}: RailFilterBarProps<K>) {
  if (available.length < 2) return null;

  return (
    <div className="contents" onPointerEnter={onIntent} onPointerDown={onIntent} onFocus={onIntent}>
      <SegmentedFilter
        label={label}
        options={available.map((id) => ({ id, label: labels[id] }))}
        value={active}
        onChange={onSelect}
        className="md:px-0"
      />
    </div>
  );
}

interface RailBodyProps<T> {
  filter: Pick<RailFilterState<string, T>, 'items' | 'loadFailed' | 'isRetrying' | 'retry'>;
  failedTitle: string;
  skeleton: ReactNode;
  children: (items: T[]) => ReactNode;
}

export function RailBody<T>({ filter, failedTitle, skeleton, children }: RailBodyProps<T>) {
  if (filter.items) return children(filter.items);
  if (!filter.loadFailed) return <div aria-hidden>{skeleton}</div>;

  return (
    <div className="px-4 md:px-0">
      <SectionError title={failedTitle} onRetry={filter.retry} isRetrying={filter.isRetrying} />
    </div>
  );
}
