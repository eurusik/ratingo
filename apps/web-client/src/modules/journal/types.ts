/**
 * Journal module types.
 *
 * Re-exports types from @ratingo/api-contract for type safety.
 * Domain types for use in components and hooks.
 */

import type { components } from '@ratingo/api-contract';

// ============================================================================
// API DTO Types (from OpenAPI spec)
// ============================================================================

/** Post list item from API */
export type PostListItemDto = components['schemas']['PostListItemDto'];

/** Post detail with navigation from API */
export type PostDetailDto = components['schemas']['PostDetailDto'];

/** Admin post with draft status from API */
export type AdminPostDto = components['schemas']['AdminPostDto'];

/** Paginated posts response from API */
export type PostListResponseDto = components['schemas']['PostListResponseDto'];

/** Admin paginated posts response from API */
export type AdminPostListResponseDto = components['schemas']['AdminPostListResponseDto'];

/** Pagination metadata from API */
export type PostPaginationMetaDto = components['schemas']['PostPaginationMetaDto'];

/** Navigation link from API */
export type PostNavigationLinkDto = components['schemas']['PostNavigationLinkDto'];

/** Navigation links from API */
export type PostNavigationDto = components['schemas']['PostNavigationDto'];

/** Create post input from API */
export type CreatePostDto = components['schemas']['CreatePostDto'];

/** Update post input from API */
export type UpdatePostDto = components['schemas']['UpdatePostDto'];

/** Image upload response from API */
export type ImageUploadResponseDto = components['schemas']['ImageUploadResponseDto'];

// ============================================================================
// Domain Types (for use in components)
// ============================================================================

/**
 * Post type values as const for type safety.
 */
export const POST_TYPE_VALUES = ['update', 'explanation', 'fix', 'roadmap'] as const;

/**
 * Post type enum.
 */
export type PostType = (typeof POST_TYPE_VALUES)[number];

/**
 * Post status values as const for type safety.
 */
export const POST_STATUS_VALUES = ['draft', 'published', 'scheduled'] as const;

/**
 * Post status for admin views.
 */
export type PostStatus = (typeof POST_STATUS_VALUES)[number];

/**
 * Query params for public posts list.
 */
export interface PostsQueryParams {
  type?: PostType[];
  context?: string;
  page?: number;
  limit?: number;
}

/**
 * Query params for admin posts list.
 */
export interface AdminPostsQueryParams extends PostsQueryParams {
  status?: PostStatus;
}

// ============================================================================
// Domain Types (mapped from DTOs in hooks)
// ============================================================================

/**
 * Navigation link to adjacent post (domain type).
 */
export interface PostNavigationLink {
  slug: string;
  title: string;
}

/**
 * Navigation links for post detail view (domain type).
 */
export interface PostNavigation {
  prev: PostNavigationLink | null;
  next: PostNavigationLink | null;
}

/**
 * Journal post for list view (domain type).
 */
export interface JournalPostListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  type: PostType;
  featuredImageUrl: string | null;
  publishedAt: Date;
  createdAt: Date;
}

/**
 * Full journal post for detail view (domain type).
 */
export interface JournalPost extends JournalPostListItem {
  body: string;
  bodyHtml: string;
  contextId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: Date;
  navigation: PostNavigation;
}

/**
 * Admin post with draft status (domain type).
 */
export interface AdminJournalPost extends JournalPost {
  isDraft: boolean;
  authorId: string;
}

/**
 * Paginated posts response (domain type).
 */
export interface JournalPostsResult {
  posts: JournalPostListItem[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

/**
 * Admin paginated posts response (domain type).
 */
export interface AdminJournalPostsResult {
  posts: AdminJournalPost[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}
