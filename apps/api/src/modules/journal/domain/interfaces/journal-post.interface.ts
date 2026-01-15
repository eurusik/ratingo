import { PostType } from '../constants/post-types';

/**
 * Journal post domain entity.
 */
export interface JournalPost {
  id: string;
  slug: string;
  title: string;
  body: string;
  bodyHtml: string;
  excerpt: string;
  type: PostType;
  featuredImageUrl: string | null;
  contextId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isDraft: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
}

/**
 * Navigation links for post detail view.
 */
export interface PostNavigation {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

/**
 * Response for single post endpoint with navigation.
 */
export interface PostDetailResponse extends JournalPost {
  navigation: PostNavigation;
}
