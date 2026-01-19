/**
 * Watchlist component displaying watching items from user_media.
 */

'use client';

import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';
import { useWatching } from '../hooks/use-me-lists';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';

export function Watchlist() {
  const { dict } = useTranslation();
  const { data, isLoading } = useWatching();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg bg-cinema-card/50">
            <Skeleton className="w-16 h-24 rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <MeListItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
