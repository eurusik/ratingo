import { Injectable } from '@nestjs/common';

import {
  type JournalPost,
  type PostNavigation,
} from '../../domain/interfaces/journal-post.interface';
import {
  type CreateJournalPostData,
  type FindPublishedFilters,
  JournalRepository,
  type PaginatedPostsResult,
  type UpdateJournalPostData,
} from '../../infrastructure/journal.repository';

/**
 * Application service for journal post operations.
 * Orchestrates domain logic and delegates persistence to JournalRepository.
 */
@Injectable()
export class JournalService {
  constructor(private readonly repository: JournalRepository) {}

  /**
   * Returns paginated list of published posts.
   */
  findPublished(filters: FindPublishedFilters): Promise<PaginatedPostsResult> {
    return this.repository.findPublished(filters);
  }

  /**
   * Finds a published post by slug.
   */
  findBySlug(slug: string): Promise<JournalPost | null> {
    return this.repository.findBySlug(slug);
  }

  /**
   * Finds the most recent published post for a given context.
   */
  findByContext(contextId: string): Promise<JournalPost | null> {
    return this.repository.findByContext(contextId);
  }

  /**
   * Finds a post by ID (admin — includes drafts).
   */
  findById(id: string): Promise<JournalPost | null> {
    return this.repository.findById(id);
  }

  /**
   * Checks if a slug already exists.
   */
  existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    return this.repository.existsBySlug(slug, excludeId);
  }

  /**
   * Creates a new journal post.
   */
  create(data: CreateJournalPostData): Promise<JournalPost> {
    return this.repository.create(data);
  }

  /**
   * Updates an existing journal post.
   */
  update(id: string, data: UpdateJournalPostData): Promise<JournalPost | null> {
    return this.repository.update(id, data);
  }

  /**
   * Deletes a journal post.
   */
  delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /**
   * Gets navigation links (prev/next) for a post.
   */
  getNavigation(post: JournalPost): Promise<PostNavigation> {
    return this.repository.getNavigation(post);
  }

  /**
   * Finds all posts for admin (includes drafts, supports status filter).
   */
  findAll(filters: {
    page: number;
    limit: number;
    status?: 'draft' | 'published' | 'scheduled';
  }): Promise<PaginatedPostsResult> {
    return this.repository.findAll(filters);
  }
}
