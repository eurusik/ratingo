'use client';

import type { Route } from 'next';
import { LinkToggleGroup } from '@/shared/ui';
import type { PoolType } from '../config';

interface PoolSelectorProps {
  currentPool: PoolType;
  trendingHref: Route;
  popularHref: Route;
  labels: {
    trending: string;
    popular: string;
  };
}

export function PoolSelector({
  currentPool,
  trendingHref,
  popularHref,
  labels,
}: PoolSelectorProps) {
  return (
    <LinkToggleGroup
      items={[
        { value: 'trending', label: labels.trending, href: trendingHref },
        { value: 'popular', label: labels.popular, href: popularHref },
      ]}
      value={currentPool}
      shape="rounded"
    />
  );
}
