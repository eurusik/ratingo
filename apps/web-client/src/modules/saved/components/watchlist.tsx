'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from '@/shared/i18n';
import { InfiniteScrollLoader } from '@/shared/components/infinite-scroll-loader';
import { useWatching, PAGE_SIZE, type MeListSort } from '../hooks/use-me-lists';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';
import { ListSortSelect } from './list-sort-select';
import { MeListSkeleton } from './me-list-skeleton';

export function Watchlist() {
  const { dict } = useTranslation();
  const [sort, setSort] = useState<MeListSort>('recent');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useWatching({ sort, limit });

  const handleSortChange = useCallback((newSort: MeListSort) => {
    setSort(newSort);
    setLimit(PAGE_SIZE);
  }, []);

  const handleLoadMore = useCallback(() => {
    setLimit((prev) => prev + PAGE_SIZE);
  }, []);

  if (isLoading) {
    return <MeListSkeleton />;
  }

  const items = data?.data ?? [];
  const hasMore = data?.meta?.hasMore ?? false;

  if (items.length === 0) {
    return (
      <EmptyState
        type="watchlist"
        title={dict.activity?.empty?.watching?.title ?? 'Ще нічого не дивитесь'}
        description={dict.activity?.empty?.watching?.description ?? 'Почніть дивитись серіал і він з\'явиться тут'}
        showImportCta
        importHint={dict.saved?.emptyState?.importHint}
        importButtonLabel={dict.saved?.emptyState?.importButton}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ListSortSelect value={sort} onChange={handleSortChange} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <MeListItemCard key={item.id} item={item} />
        ))}
      </div>
      <InfiniteScrollLoader
        onLoadMore={handleLoadMore}
        isLoading={isFetching && items.length > 0}
        hasMore={hasMore}
        loadingText={dict.common?.loading ?? 'Завантаження...'}
      />
    </div>
  );
}
