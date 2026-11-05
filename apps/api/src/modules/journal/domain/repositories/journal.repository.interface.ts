import { type PostType } from '../constants/post-types';
import { type JournalPost, type PostNavigation } from '../interfaces/journal-post.interface';

export interface CreateJournalPostData {
  slug: string;
  title: string;
  body: string;
  bodyHtml: string;
  excerpt: string;
  type: PostType;
  featuredImageUrl?: string | null;
  contextId?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isDraft: boolean;
  publishedAt?: Date | null;
  authorId: string;
}

export interface UpdateJournalPostData {
  slug?: string;
  title?: string;
  body?: string;
  bodyHtml?: string;
  excerpt?: string;
  type?: PostType;
  featuredImageUrl?: string | null;
  contextId?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isDraft?: boolean;
  publishedAt?: Date | null;
}

export interface FindPublishedFilters {
  types?: PostType[];
  contextId?: string;
  page: number;
  limit: number;
}

export interface FindAllPostsFilters {
  page: number;
  limit: number;
  status?: 'draft' | 'published' | 'scheduled';
}

export interface PaginatedPostsResult {
  posts: JournalPost[];
  total: number;
}

export interface IJournalRepository {
  findPublished(filters: FindPublishedFilters): Promise<PaginatedPostsResult>;
  findBySlug(slug: string): Promise<JournalPost | null>;
  findById(id: string): Promise<JournalPost | null>;
  findByContext(contextId: string): Promise<JournalPost | null>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  create(data: CreateJournalPostData): Promise<JournalPost>;
  update(id: string, data: UpdateJournalPostData): Promise<JournalPost | null>;
  delete(id: string): Promise<boolean>;
  getNavigation(currentPost: JournalPost): Promise<PostNavigation>;
  findAll(filters: FindAllPostsFilters): Promise<PaginatedPostsResult>;
}

export const JOURNAL_REPOSITORY = Symbol('JOURNAL_REPOSITORY');
