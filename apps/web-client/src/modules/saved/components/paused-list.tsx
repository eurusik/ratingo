/**
 * PausedList component displaying paused items from user_media.
 */

'use client';

import { useTranslation } from '@/shared/i18n';
import { InfiniteScrollLoader } from '@/shared/components/infinite-scroll-loader';
import { usePaused } from '../hooks/use-me-lists';
import { useMeListState } from '../hooks/use-me-list-state';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';
import { ListSortSelect } from './list-sort-select';
import { MediaTypeFilter } from './media-type-filter';
import { MeListSkeleton } from './me-list-skeleton';
import { ActivityFilterIndicator } from './activity-filter-indicator';

interface PausedListProps {
  totalAcrossTypes?: number;
}

export function PausedList({ totalAcrossTypes = 0 }: PausedListProps = {}) {
  const { dict } = useTranslation();
  const { sort, mediaType, handleSortChange, handleMediaTypeChange } = useMeListState();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = usePaused({ sort, type: mediaType });
  const filteredTotal = data?.pages[0]?.meta?.total ?? 0;

  if (isLoading) {
    return <MeListSkeleton />;
  }

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  const emptyTitle = mediaType === 'movie'
    ? (dict.activity?.empty?.noMovies ?? 'Немає фільмів')
    : mediaType === 'show'
      ? (dict.activity?.empty?.noShows ?? 'Немає серіалів')
      : undefined;

  if (items.length === 0 && mediaType === 'all') {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <MediaTypeFilter value={mediaType} onChange={handleMediaTypeChange} />
        <ListSortSelect value={sort} onChange={handleSortChange} />
      </div>
      <ActivityFilterIndicator
        mediaType={mediaType}
        filteredTotal={filteredTotal}
        totalAcrossTypes={totalAcrossTypes}
        onReset={() => handleMediaTypeChange('all')}
      />
      {items.length === 0 && emptyTitle ? (
        <p className="text-cinema-text-muted text-center py-16">{emptyTitle}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <MeListItemCard key={item.id} item={item} />
            ))}
          </div>
          <InfiniteScrollLoader
            onLoadMore={() => fetchNextPage()}
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage ?? false}
            loadingText={dict.common?.loading ?? 'Завантаження...'}
          />
        </>
      )}
    </div>
  );
}
