'use client';

/**
 * Client component for journal list page.
 * Handles filtering and uses SSR initial data.
 */

import { useMemo, useState } from 'react';

import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui/skeleton';

import {
  useJournalPosts,
  PostTypeFilter,
  PostList,
  type PostType,
  type PostListResponseDto,
  type JournalPostsResult,
  type JournalPostListItem,
} from '@/modules/journal';

interface JournalPageClientProps {
  initialData: PostListResponseDto | null;
}

/**
 * Maps API DTO to domain type for initial data.
 */
function mapInitialData(dto: PostListResponseDto | null): JournalPostsResult | undefined {
  if (!dto) return undefined;

  return {
    posts: dto.posts.map((post): JournalPostListItem => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      type: post.type as PostType,
      featuredImageUrl: post.featuredImageUrl ?? null,
      publishedAt: new Date(post.publishedAt),
      createdAt: new Date(post.createdAt),
    })),
    meta: {
      total: dto.meta.total,
      page: dto.meta.page,
      totalPages: dto.meta.totalPages,
      limit: dto.meta.limit,
    },
  };
}

/**
 * Journal page client component with filtering.
 * Uses SSR initial data for first render.
 */
export function JournalPageClient({ initialData }: JournalPageClientProps) {
  const { t } = useTranslation();
  const [selectedTypes, setSelectedTypes] = useState<PostType[]>([]);

  // Map initial data once
  const mappedInitialData = useMemo(() => mapInitialData(initialData), [initialData]);

  // Only use initial data when no filters are applied
  const queryInitialData = selectedTypes.length === 0 ? mappedInitialData : undefined;

  const { data, isLoading, error } = useJournalPosts(
    { type: selectedTypes.length > 0 ? selectedTypes : undefined },
    { initialData: queryInitialData },
  );

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
        <div className="space-y-8">
          {/* Featured post skeleton */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <Skeleton className="aspect-[21/9] w-full rounded-lg" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>

          {/* List items skeleton */}
          <div className="space-y-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-6 py-5 border-b border-border/50"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-6 w-28 rounded-full hidden sm:block" />
              </div>
            ))}
          </div>
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
