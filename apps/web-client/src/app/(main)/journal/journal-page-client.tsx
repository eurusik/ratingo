'use client';

/**
 * Client component for journal list page.
 * Handles filtering and data fetching.
 */

import { useState } from 'react';

import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui/skeleton';

import { useJournalPosts, PostTypeFilter, PostList, type PostType } from '@/modules/journal';

/**
 * Journal page client component with filtering.
 */
export function JournalPageClient() {
  const { t } = useTranslation();
  const [selectedTypes, setSelectedTypes] = useState<PostType[]>([]);

  const { data, isLoading, error } = useJournalPosts({
    type: selectedTypes.length > 0 ? selectedTypes : undefined,
  });

  return (
    <>
      {/* Filters */}
      <PostTypeFilter
        selected={selectedTypes}
        onChange={setSelectedTypes}
        className="mb-8"
      />

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{t('common.error')}</p>
        </div>
      ) : (
        <PostList posts={data?.posts ?? []} />
      )}
    </>
  );
}
