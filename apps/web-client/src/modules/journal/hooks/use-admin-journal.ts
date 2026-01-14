'use client';

/**
 * Admin hooks for journal post management.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import { journalApi } from '@/core/api/journal';
import { queryKeys } from '@/core/query/keys';

import type {
  AdminPostDto,
  AdminPostListResponseDto,
  AdminPostsQueryParams,
  AdminJournalPostsResult,
  AdminJournalPost,
  CreatePostDto,
  UpdatePostDto,
  PostType,
  PostNavigation,
} from '../types';

// =============================================================================
// Mappers
// =============================================================================

/**
 * Maps navigation DTO to domain type.
 */
function mapNavigation(dto: AdminPostDto['navigation']): PostNavigation {
  return {
    prev: dto.prev ? { slug: dto.prev.slug, title: dto.prev.title } : null,
    next: dto.next ? { slug: dto.next.slug, title: dto.next.title } : null,
  };
}

/**
 * Maps admin post DTO to domain type.
 */
function mapAdminPost(dto: AdminPostDto): AdminJournalPost {
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
    isDraft: dto.isDraft,
    authorId: dto.authorId,
  };
}

/**
 * Maps admin posts list response to domain type.
 */
function mapAdminPostsResponse(dto: AdminPostListResponseDto): AdminJournalPostsResult {
  return {
    posts: dto.posts.map(mapAdminPost),
    meta: {
      total: dto.meta.total,
      page: dto.meta.page,
      totalPages: dto.meta.totalPages,
      limit: dto.meta.limit,
    },
  };
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook for fetching admin posts list.
 */
export function useAdminJournalPosts(
  params: AdminPostsQueryParams = {},
  options?: Omit<UseQueryOptions<AdminJournalPostsResult>, 'queryKey' | 'queryFn'>,
): UseQueryResult<AdminJournalPostsResult> {
  return useQuery({
    queryKey: queryKeys.admin.journal.list(params.page, params.limit, params.status),
    queryFn: async () => {
      const response = await journalApi.getAdminPosts(params);
      return mapAdminPostsResponse(response);
    },
    ...options,
  });
}

/**
 * Hook for fetching a single admin post by ID.
 */
export function useAdminJournalPost(
  id: string,
  options?: Omit<UseQueryOptions<AdminJournalPost>, 'queryKey' | 'queryFn'>,
): UseQueryResult<AdminJournalPost> {
  return useQuery({
    queryKey: queryKeys.admin.journal.detail(id),
    queryFn: async () => {
      const response = await journalApi.getAdminPost(id);
      return mapAdminPost(response);
    },
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook for creating a new post.
 */
export function useCreatePost(): UseMutationResult<AdminJournalPost, Error, CreatePostDto> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePostDto) => {
      const response = await journalApi.createPost(data);
      return mapAdminPost(response);
    },
    onSuccess: () => {
      // Invalidate admin list
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.journal.all });
      // Invalidate public list (new post might be published)
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}

/**
 * Hook for updating a post.
 */
export function useUpdatePost(): UseMutationResult<
  AdminJournalPost,
  Error,
  { id: string; data: UpdatePostDto }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await journalApi.updatePost(id, data);
      return mapAdminPost(response);
    },
    onSuccess: (post) => {
      // Update cache for this post
      queryClient.setQueryData(queryKeys.admin.journal.detail(post.id), post);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.journal.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}

/**
 * Hook for deleting a post.
 */
export function useDeletePost(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await journalApi.deletePost(id);
    },
    onSuccess: () => {
      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.journal.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}

/**
 * Hook for publishing a post.
 */
export function usePublishPost(): UseMutationResult<AdminJournalPost, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await journalApi.publishPost(id);
      return mapAdminPost(response);
    },
    onSuccess: (post) => {
      // Update cache for this post
      queryClient.setQueryData(queryKeys.admin.journal.detail(post.id), post);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.journal.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}

/**
 * Hook for unpublishing a post.
 */
export function useUnpublishPost(): UseMutationResult<AdminJournalPost, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await journalApi.unpublishPost(id);
      return mapAdminPost(response);
    },
    onSuccess: (post) => {
      // Update cache for this post
      queryClient.setQueryData(queryKeys.admin.journal.detail(post.id), post);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.journal.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all });
    },
  });
}
