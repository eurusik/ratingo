'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { whenIdleOnFastConnection } from '@/shared/lib';
import { SegmentedFilter } from '@/shared/ui';
import { activeList, type RailStart } from '../model/home-feed';

const RAIL_STALE_MS = 60_000;

const chosenBySection = new Map<string, string>();

function railQuery<K extends string, T>(
  sectionId: string,
  list: K | undefined,
  loadList: (list: K) => Promise<T[]>,
) {
  return {
    queryKey: ['home-rail', sectionId, list],
    queryFn: () => loadList(list as K),
    staleTime: RAIL_STALE_MS,
    enabled: list !== undefined,
  };
}

export function useRailFilter<K extends string, T>(
  sectionId: string,
  { available, first }: RailStart<K, T>,
  loadList: (list: K) => Promise<T[]>,
) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState(() => chosenBySection.get(sectionId) as K | undefined);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const active = activeList(available, chosen);
  const isFirstList = active === first?.list;
  const { data: fetchedItems } = useQuery(
    railQuery(sectionId, isFirstList ? undefined : active, loadList),
  );
  const items = isFirstList ? first?.items : fetchedItems;

  const otherLists = available.filter((list) => list !== first?.list);
  const prefetchOthers = () => {
    for (const list of otherLists)
      void queryClient.prefetchQuery(railQuery(sectionId, list, loadList));
  };
  const prefetchOthersWhenIdle = useEffectEvent(prefetchOthers);

  useEffect(() => whenIdleOnFastConnection(() => prefetchOthersWhenIdle()), []);

  const select = (next: K) => {
    chosenBySection.set(sectionId, next);
    setChosen(next);
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
  };

  return {
    active,
    available,
    items,
    select,
    prefetchOthers,
    scrollerRef,
    memoryKey: `${sectionId}:${active}`,
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
