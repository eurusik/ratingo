/**
 * History list component displaying watched items (watching/completed).
 */

'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useCompleted, type MeListSort } from '../hooks/use-me-lists';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';
import { ListSortSelect } from './list-sort-select';
import { MeListSkeleton } from './me-list-skeleton';

/**
 * Render the user's watch history with sorting, loading, and empty-state handling.
 *
 * Shows a loading skeleton while data is being fetched, an empty-state message when there are no history items,
 * and otherwise a right-aligned sort control plus a responsive grid of history item cards.
 *
 * @returns A React element that displays either the loading skeleton, the empty-state UI, or a sortable grid of history items.
 */
export function HistoryList() {
  const { dict } = useTranslation();
  const [sort, setSort] = useState<MeListSort>('recent');
  const { data, isLoading } = useCompleted(sort);

  if (isLoading) {
    return <MeListSkeleton />;
  }

  const items = data?.data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        type="history"
        title={dict.activity?.empty?.history?.title ?? 'Історія порожня'}
        description={dict.activity?.empty?.history?.description ?? 'Ви ще нічого не переглянули'}
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