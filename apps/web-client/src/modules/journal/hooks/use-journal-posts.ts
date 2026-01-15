'use client';

/**
 * Hook for fetching paginated journal posts.
 */

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { journalApi } from '@/core/api/journal.client';
import { queryKeys } from '@/core/query/keys';

import type {
  PostListResponseDto,
  PostsQueryParams,
  JournalPostsResult,
  JournalPostListItem,
  PostType,
} from '../types';

/**
 * Maps API DTO to domain type.
 * Converts date strings to Date objects.
 */
function mapPostListItem(dto: PostListResponseDto['posts'][number]): JournalPostListItem {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    excerpt: dto.excerpt,
    type: dto.type as PostType,
    featuredImageUrl: dto.featuredImageUrl ?? null,
    publishedAt: new Date(dto.publishedAt),
    createdAt: new Date(dto.createdAt),
  };
}

/**
 * Maps API response to domain type.
 */
function mapPostsResponse(dto: PostListResponseDto): JournalPostsResult {
  return {
    posts: dto.posts.map(mapPostListItem),
    meta: {
      total: dto.meta.total,
      page: dto.meta.page,
      totalPages: dto.meta.totalPages,
      limit: dto.meta.limit,
    },
  };
}

/**
 * Creates types string for query key.
 * Returns undefined to let query key factory normalize to null.
 */
function typesToKey(types?: PostType[]): string | undefined {
  if (!types || types.length === 0) return undefined;
  return types.sort().join(',');
}

/**
 * Hook for fetching paginated journal posts.
 *
 * @param params - Query parameters (type filter, pagination)
 * @param options - React Query options
 * @returns Query result with posts and pagination meta
 *
 * @example
 * const { data, isLoading } = useJournalPosts({ type: ['update'], page: 1 });
 */
export function useJournalPosts(
  params: PostsQueryParams = {},
  options?: Omit<UseQueryOptions<JournalPostsResult>, 'queryKey' | 'queryFn'>,
): UseQueryResult<JournalPostsResult> {
  return useQuery({
    queryKey: queryKeys.journal.list(params.page, params.limit, typesToKey(params.type)),
    queryFn: async () => {
      const response = await journalApi.getPosts(params);
      return mapPostsResponse(response);
    },
    staleTime: 1000 * 60, // 1 minute
    ...options,
  });
}
