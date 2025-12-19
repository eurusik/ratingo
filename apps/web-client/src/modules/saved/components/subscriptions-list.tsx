/**
 * List component for subscriptions (notifications) with loading and empty states.
 */

'use client';

import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';
import type { SubscriptionTrigger } from '@/shared/types';
import { useSubscriptions, useUnsubscribe } from '../hooks';
import { SubscriptionCard } from './subscription-card';
import { EmptyState } from './empty-state';

export function SubscriptionsList() {
  const { dict } = useTranslation();
  const { data, isLoading } = useSubscriptions();
  const unsubscribeMutation = useUnsubscribe();

  const handleUnsubscribe = (mediaItemId: string, trigger: SubscriptionTrigger) => {
    unsubscribeMutation.mutate({ mediaItemId, trigger, context: 'saved-page' });
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
    return (
      <EmptyState
        type="notifications"
        title={dict.saved.empty.notifications.title}
        description={dict.saved.empty.notifications.description}
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
        };
        
        return (
          <SubscriptionCard
            key={item.id}
            id={item.id}
            mediaItemId={item.mediaItemId}
            title={media.title}
            type={media.type}
            slug={media.slug}
            posterUrl={media.poster?.small ?? null}
            trigger={item.trigger}
            onUnsubscribe={() => handleUnsubscribe(item.mediaItemId, item.trigger)}
            isUnsubscribing={unsubscribeMutation.isPending}
          />
        );
      })}
    </div>
  );
}
