'use client';

import { useParams } from 'next/navigation';
import { Skeleton } from '@heroui/react';
import { currentYear } from '@/shared/lib';
import {
  browseCategoriesOfType,
  DEFAULT_BROWSE_CATEGORY,
  findBrowseCategory,
  type BrowseCategory,
} from '../model/browse-category';
import { GENRE_SLUGS } from '../model/genres';
import { yearPresets } from '../model/year-presets';
import { BrowseGridSkeleton } from './browse-grid';
import { BrowseLayout } from './browse-layout';

const CHIP_WIDTHS = ['w-32', 'w-40', 'w-24', 'w-32', 'w-36'] as const;
const TAG_WIDTHS = ['w-24', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-28'] as const;
const VISIBLE_POOL_CHIPS_ON_PHONE = 3;
const ANY_YEAR_TAGS = 1;

function cycledWidths(widths: readonly string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) => widths[index % widths.length] ?? '');
}

function useLoadingCategory(): BrowseCategory {
  const category = useParams()?.category;
  const slug = typeof category === 'string' ? category : undefined;
  return (slug === undefined ? undefined : findBrowseCategory(slug)) ?? DEFAULT_BROWSE_CATEGORY;
}

function TypeSwitchSkeleton() {
  return (
    <div className="flex min-h-tap items-center gap-5">
      <Skeleton className="h-8 w-32 rounded-lg md:h-9 md:w-40" />
      <Skeleton className="h-8 w-28 rounded-lg md:h-9 md:w-36" />
    </div>
  );
}

function PoolsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
      {Array.from(cycledWidths(CHIP_WIDTHS, count), (width, index) => (
        <Skeleton
          key={index}
          className={`h-10 shrink-0 rounded-full ${width} ${
            index < VISIBLE_POOL_CHIPS_ON_PHONE ? '' : 'hidden sm:block'
          }`}
        />
      ))}
    </div>
  );
}

function TagsSkeleton({ widths }: { widths: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from(widths, (width, index) => (
        <Skeleton key={index} className={`h-10 rounded-full ${width}`} />
      ))}
    </div>
  );
}

function FiltersPanelSkeleton({ category }: { category: BrowseCategory }) {
  const genreCount = GENRE_SLUGS[category.type].length;
  const yearCount = yearPresets(currentYear()).length + ANY_YEAR_TAGS;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-full" />
          <TagsSkeleton widths={cycledWidths(TAG_WIDTHS, genreCount)} />
        </div>
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-24 rounded-full" />
          <TagsSkeleton widths={cycledWidths(TAG_WIDTHS, yearCount)} />
        </div>
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-3 w-40 rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function BrowseSkeleton({ label }: { label: string }) {
  const category = useLoadingCategory();
  const { isFilterable } = category;

  return (
    <div role="status" className="flex flex-col pb-10">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col">
        <BrowseLayout
          typeSwitch={<TypeSwitchSkeleton />}
          pools={<PoolsSkeleton count={browseCategoriesOfType(category.type).length} />}
          filtersButton={
            isFilterable ? <Skeleton className="h-10 w-10 rounded-full sm:w-28" /> : undefined
          }
          filtersPanel={isFilterable ? <FiltersPanelSkeleton category={category} /> : undefined}
          summary={
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-56 max-w-full rounded-full" />
            </div>
          }
          sort={<Skeleton className="h-5 w-36 shrink-0 rounded-full" />}
          results={<BrowseGridSkeleton hasSidebar={isFilterable} />}
        />
      </div>
    </div>
  );
}
