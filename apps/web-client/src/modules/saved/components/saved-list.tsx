/**
 * List component for saved items with loading and empty states.
 */

'use client';

import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';
import { useSavedForLater, useSavedConsidering, useUnsaveItem, useSaveItem } from '../hooks';
import { SavedItemCard } from './saved-item-card';
import { EmptyState } from './empty-state';

interface SavedListProps {
  list: 'for_later' | 'considering';
}

export function SavedList({ list }: SavedListProps) {
  const { dict } = useTranslation();
  const isForLater = list === 'for_later';
  
  const { data, isLoading } = isForLater 
    ? useSavedForLater() 
    : useSavedConsidering();
  
  const unsaveMutation = useUnsaveItem();
  const saveMutation = useSaveItem();

  const handleRemove = (mediaItemId: string) => {
    unsaveMutation.mutate({ mediaItemId, list, context: 'saved-page' });
  };

  const handleMove = (mediaItemId: string) => {
    const targetList = isForLater ? 'considering' : 'for_later';
    saveMutation.mutate({ mediaItemId, list: targetList, context: 'saved-page' });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg bg-zinc-900/50">
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

  const items = data?.data ?? [];

  if (items.length === 0) {
    const emptyType = isForLater ? 'forLater' : 'considering';
    return (
      <EmptyState
        type={emptyType}
        title={dict.saved.empty[emptyType].title}
        description={dict.saved.empty[emptyType].description}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const media = item.mediaSummary as unknown as {
          id: string;
          type: 'movie' | 'show';
          title: string;
          slug: string;
          poster: Record<string, string> | null;
          releaseDate?: string | null;
        };
        
        return (
          <SavedItemCard
            key={item.id}
            id={item.id}
            mediaItemId={item.mediaItemId}
            title={media.title}
            type={media.type}
            slug={media.slug}
            posterUrl={media.poster?.small ?? null}
            releaseDate={media.releaseDate}
            reasonKey={(item as unknown as { reasonKey?: string | null }).reasonKey}
            onRemove={() => handleRemove(item.mediaItemId)}
            onMove={() => handleMove(item.mediaItemId)}
            moveLabel={isForLater 
              ? dict.saved.actions.moveToConsidering 
              : dict.saved.actions.moveToForLater
            }
            isRemoving={unsaveMutation.isPending}
          />
        );
      })}
    </div>
  );
}
