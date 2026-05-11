'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';
import { InfiniteScrollLoader } from '@/shared/components/infinite-scroll-loader';
import { useSavedForLater, useSavedConsidering, useUnsaveItem, useSaveItem } from '../hooks';
import { type MediaTypeFilter as MediaTypeFilterValue } from '../hooks/use-me-lists';
import { SavedItemCard } from './saved-item-card';
import { EmptyState } from './empty-state';
import { MediaTypeFilter } from './media-type-filter';
import { SavedFilterIndicator } from './saved-filter-indicator';

interface SavedListProps {
  list: 'for_later' | 'considering';
  totalAcrossTypes?: number;
}

export function SavedList({ list, totalAcrossTypes = 0 }: SavedListProps) {
  const { dict } = useTranslation();
  const isForLater = list === 'for_later';
  const [mediaType, setMediaType] = useState<MediaTypeFilterValue>('all');

  const forLaterQuery = useSavedForLater({ type: mediaType, enabled: isForLater });
  const consideringQuery = useSavedConsidering({ type: mediaType, enabled: !isForLater });
  const query = isForLater ? forLaterQuery : consideringQuery;
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = query;
  const items = data?.pages.flatMap((p) => p.data) ?? [];
  const filteredTotal = data?.pages[0]?.meta?.total ?? 0;

  const unsaveMutation = useUnsaveItem();
  const saveMutation = useSaveItem();

  const handleMediaTypeChange = useCallback((value: MediaTypeFilterValue) => {
    setMediaType(value);
  }, []);

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const handleRemove = useCallback((mediaItemId: string) => {
    unsaveMutation.mutate({ mediaItemId, list, context: 'saved-page' });
  }, [unsaveMutation, list]);

  const handleMove = useCallback((mediaItemId: string) => {
    const targetList = isForLater ? 'considering' : 'for_later';
    saveMutation.mutate({ mediaItemId, list: targetList, context: 'saved-page' });
  }, [saveMutation, isForLater]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg bg-cinema-card/50">
            <Skeleton className="w-16 h-24 rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const emptyTitle = mediaType === 'movie'
    ? (dict.saved?.empty?.noMovies ?? 'Немає фільмів')
    : mediaType === 'show'
      ? (dict.saved?.empty?.noShows ?? 'Немає серіалів')
      : undefined;

  if (items.length === 0 && mediaType === 'all') {
    const emptyType = isForLater ? 'forLater' : 'considering';
    return (
      <EmptyState
        type={emptyType}
        title={dict.saved.empty[emptyType].title}
        description={dict.saved.empty[emptyType].description}
        showImportCta={isForLater}
        importHint={dict.saved?.emptyState?.importHint}
        importButtonLabel={dict.saved?.emptyState?.importButton}
      />
    );
  }

  return (
    <div className="space-y-4">
      <MediaTypeFilter value={mediaType} onChange={handleMediaTypeChange} />
      <SavedFilterIndicator
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
            {items.map((item) => {
              const media = item.mediaSummary;
              const poster = media.poster as Record<string, string> | null;

              return (
                <SavedItemCard
                  key={item.id}
                  id={item.id}
                  mediaItemId={item.mediaItemId}
                  title={media.title}
                  type={media.type as 'movie' | 'show'}
                  slug={media.slug}
                  posterUrl={poster?.small ?? null}
                  releaseDate={media.releaseDate}
                  reasonKey={item.reasonKey}
                  activeSubscriptionTriggers={item.activeSubscriptionTriggers}
                  onRemove={() => handleRemove(item.mediaItemId)}
                  onMove={() => handleMove(item.mediaItemId)}
                  moveLabel={
                    isForLater ? dict.saved.actions.moveToConsidering : dict.saved.actions.moveToForLater
                  }
                  isRemoving={unsaveMutation.isPending}
                />
              );
            })}
          </div>
          <InfiniteScrollLoader
            onLoadMore={handleLoadMore}
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage ?? false}
            loadingText={dict.common?.loading ?? 'Завантаження...'}
          />
        </>
      )}
    </div>
  );
}
