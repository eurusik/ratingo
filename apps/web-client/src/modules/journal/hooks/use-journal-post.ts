'use client';

/**
 * Hook for fetching a single journal post by slug.
 */

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { journalApi } from '@/core/api/journal';
import { queryKeys } from '@/core/query/keys';

import type { PostDetailDto, JournalPost, PostType, PostNavigation } from '../types';

/**
 * Maps navigation DTO to domain type.
 */
function mapNavigation(dto: PostDetailDto['navigation']): PostNavigation {
  return {
    prev: dto.prev ? { slug: dto.prev.slug, title: dto.prev.title } : null,
    next: dto.next ? { slug: dto.next.slug, title: dto.next.title } : null,
  };
}

/**
 * Maps API DTO to domain type.
 * Converts date strings to Date objects.
 */
function mapPostDetail(dto: PostDetailDto): JournalPost {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    excerpt: dto.excerpt,
    type: dto.type as PostType,
    featuredImageUrl: dto.featuredImageUrl ?? null,
    publishedAt: new Date(dto.publishedAt),
    createdAt: new Date(dto.createdAt),
    body: dto.body,
    bodyHtml: dto.bodyHtml,
    contextId: dto.contextId ?? null,
    metaTitle: dto.metaTitle ?? null,
    metaDescription: dto.metaDescription ?? null,
    updatedAt: new Date(dto.updatedAt),
    navigation: mapNavigation(dto.navigation),
  };
}

/**
 * Hook for fetching a single journal post by slug.
 *
 * @param slug - Post URL slug
 * @param options - React Query options
 * @returns Query result with post detail
 *
 * @example
 * const { data: post, isLoading } = useJournalPost('shcho-novoho-v-ratingo');
 */
export function useJournalPost(
  slug: string,
  options?: Omit<UseQueryOptions<JournalPost>, 'queryKey' | 'queryFn'>,
): UseQueryResult<JournalPost> {
  return useQuery({
    queryKey: queryKeys.journal.detail(slug),
    queryFn: async () => {
      const response = await journalApi.getPost(slug);
      return mapPostDetail(response);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}
