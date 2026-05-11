'use client';

import { useTranslation } from '@/shared/i18n';
import { InfiniteScrollLoader } from '@/shared/components/infinite-scroll-loader';
import { useCompleted } from '../hooks/use-me-lists';
import { useMeListState } from '../hooks/use-me-list-state';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';
import { ListSortSelect } from './list-sort-select';
import { MediaTypeFilter } from './media-type-filter';
import { MeListSkeleton } from './me-list-skeleton';
import { ActivityFilterIndicator } from './activity-filter-indicator';

interface HistoryListProps {
  totalAcrossTypes?: number;
}

export function HistoryList({ totalAcrossTypes = 0 }: HistoryListProps = {}) {
  const { dict } = useTranslation();
  const { sort, mediaType, handleSortChange, handleMediaTypeChange } = useMeListState();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useCompleted({ sort, type: mediaType });
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
        type="history"
        title={dict.activity?.empty?.history?.title ?? 'Історія порожня'}
        description={dict.activity?.empty?.history?.description ?? 'Ви ще нічого не переглянули'}
        showImportCta
        importHint={dict.saved?.emptyState?.importHint}
        importButtonLabel={dict.saved?.emptyState?.importButton}
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
