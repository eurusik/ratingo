/**
 * PausedList component displaying paused items from user_media.
 */

'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { usePaused, type MeListSort } from '../hooks/use-me-lists';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';
import { ListSortSelect } from './list-sort-select';
import { MeListSkeleton } from './me-list-skeleton';

/**
 * Render a list of the user's paused media with a sort control, handling loading and empty states.
 *
 * @returns A React element that displays a loading skeleton while data is fetching, an empty-state message when no paused items exist, or a responsive grid of paused media cards with a sort selector.
 */
export function PausedList() {
  const { dict } = useTranslation();
  const [sort, setSort] = useState<MeListSort>('recent');
  const { data, isLoading } = usePaused(sort);

  if (isLoading) {
    return <MeListSkeleton />;
  }

  const items = data?.data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        type="paused"
        title={dict.activity?.empty?.paused?.title ?? 'Немає контенту на паузі'}
        description={
          dict.activity?.empty?.paused?.description ??
          "Поставте серіал на паузу, якщо хочете повернутись пізніше"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ListSortSelect value={sort} onChange={setSort} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <MeListItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}