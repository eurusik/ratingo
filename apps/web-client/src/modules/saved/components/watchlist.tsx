/**
 * Watchlist component displaying watching items from user_media.
 */

'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useWatching, type MeListSort } from '../hooks/use-me-lists';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';
import { ListSortSelect } from './list-sort-select';
import { MeListSkeleton } from './me-list-skeleton';

/**
 * Render the user's watchlist UI with loading, empty, and populated states and a sort control.
 *
 * Shows a loading skeleton while data is being fetched. If there are no watched items, displays
 * an empty-state panel with localized title/description (with Ukrainian fallbacks). When items are
 * available, renders a top-right sort selector and a responsive grid of item cards.
 *
 * @returns A React element containing the watchlist interface (loading skeleton, empty state, or sorted grid of items).
 */
export function Watchlist() {
  const { dict } = useTranslation();
  const [sort, setSort] = useState<MeListSort>('recent');
  const { data, isLoading } = useWatching(sort);

  if (isLoading) {
    return <MeListSkeleton />;
  }

  const items = data?.data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        type="watchlist"
        title={dict.activity?.empty?.watching?.title ?? 'Ще нічого не дивитесь'}
        description={dict.activity?.empty?.watching?.description ?? 'Почніть дивитись серіал і він з\'явиться тут'}
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