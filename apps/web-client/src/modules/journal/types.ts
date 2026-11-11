/**
 * Journal module types.
 *
 * Re-exports the journal API types from core/api/journal.types.
 * Domain types for use in components and hooks.
 */

import type { PostType } from '@/core/api/journal.types';

export * from '@/core/api/journal.types';

// ============================================================================
// Domain Types (mapped from DTOs in hooks)
// ============================================================================

/**
 * Navigation link to adjacent post (domain type).
 */
interface PostNavigationLink {
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
