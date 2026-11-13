'use client';

import { useRef, useState } from 'react';
import { SegmentedFilter } from '@/shared/ui';
import { chooseList } from '../model/home-feed';

export function useRailFilter<K extends string, T>(
  lists: Record<K, readonly T[]>,
  order: readonly [K, ...K[]],
) {
  const [chosen, setChosen] = useState<K>(order[0]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { available, active } = chooseList(lists, order, chosen);

  const select = (next: K) => {
    setChosen(next);
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
  };

  return { active, available, items: active ? lists[active] : [], select, scrollerRef };
}

interface RailFilterBarProps<K extends string> {
  label: string;
  labels: Record<K, string>;
  available: readonly K[];
  active: K;
  onSelect: (next: K) => void;
}

export function RailFilterBar<K extends string>({
  label,
  labels,
  available,
  active,
  onSelect,
}: RailFilterBarProps<K>) {
  if (available.length < 2) return null;

  return (
    <SegmentedFilter
      label={label}
      options={available.map((id) => ({ id, label: labels[id] }))}
      value={active}
      onChange={onSelect}
      className="md:px-0"
    />
  );
}
