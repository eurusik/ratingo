/**
 * DroppedList component displaying dropped items from user_media.
 */

'use client';

import { useTranslation } from '@/shared/i18n';
import { InfiniteScrollLoader } from '@/shared/components/infinite-scroll-loader';
import { useDropped, MAX_LIST_LIMIT } from '../hooks/use-me-lists';
import { useMeListState } from '../hooks/use-me-list-state';
import { MeListItemCard } from './me-list-item-card';
import { EmptyState } from './empty-state';
import { ListSortSelect } from './list-sort-select';
import { MediaTypeFilter } from './media-type-filter';
import { MeListSkeleton } from './me-list-skeleton';

export function DroppedList() {
  const { dict } = useTranslation();
  const { sort, mediaType, limit, handleSortChange, handleMediaTypeChange, handleLoadMore } = useMeListState();
  const { data, isLoading, isFetching } = useDropped({ sort, type: mediaType, limit });

  if (isLoading) {
    return <MeListSkeleton />;
  }

  const items = data?.data ?? [];
  const hasMore = (data?.meta?.hasMore ?? false) && limit < MAX_LIST_LIMIT;

  const emptyTitle = mediaType === 'movie'
    ? (dict.activity?.empty?.noMovies ?? 'Немає фільмів')
    : mediaType === 'show'
      ? (dict.activity?.empty?.noShows ?? 'Немає серіалів')
      : undefined;

  if (items.length === 0 && mediaType === 'all') {
    return (
      <EmptyState
        type="dropped"
        title={dict.activity?.empty?.dropped?.title ?? 'Немає покинутого контенту'}
        description={
          dict.activity?.empty?.dropped?.description ??
          "Контент, який ви покинули, з'явиться тут"
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
            onLoadMore={handleLoadMore}
            isLoading={isFetching && items.length > 0}
            hasMore={hasMore}
            loadingText={dict.common?.loading ?? 'Завантаження...'}
          />
        </>
      )}
    </div>
  );
}
