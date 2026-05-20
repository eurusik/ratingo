import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, count, desc, eq, gt, inArray, lt, lte, ne, or, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { type PostType } from '../domain/constants/post-types';
import { type JournalPost, type PostNavigation } from '../domain/interfaces/journal-post.interface';

/**
 * Data for creating a new journal post.
 */
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

/**
 * Data for updating an existing journal post.
 */
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

/**
 * Filters for querying published posts.
 */
export interface FindPublishedFilters {
  types?: PostType[];
  contextId?: string;
  page: number;
  limit: number;
}

/**
 * Result of paginated post query.
 */
export interface PaginatedPostsResult {
  posts: JournalPost[];
  total: number;
}

/**
 * Drizzle implementation of Journal repository.
 */
@Injectable()
export class JournalRepository {
  private readonly logger = new Logger(JournalRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Finds published posts with optional filtering and pagination.
   * Posts are sorted by publishedAt DESC with createdAt as tie-breaker.
   *
   * @param filters - Filtering and pagination options
   * @returns Paginated posts and total count
   */
  async findPublished(filters: FindPublishedFilters): Promise<PaginatedPostsResult> {
    return withDbError(
      'find published posts',
      this.logger,
      async () => {
        const now = new Date();
        const conditions = [
          eq(schema.journalPosts.isDraft, false),
          lte(schema.journalPosts.publishedAt, now),
        ];

        // Multi-type filter: posts matching ANY of the specified types (union)
        if (filters.types?.length) {
          conditions.push(inArray(schema.journalPosts.type, filters.types));
        }

        if (filters.contextId) {
          conditions.push(eq(schema.journalPosts.contextId, filters.contextId));
        }

        const whereClause = and(...conditions);

        const [posts, countResult] = await Promise.all([
          this.db
            .select()
            .from(schema.journalPosts)
            .where(whereClause)
            .orderBy(desc(schema.journalPosts.publishedAt), desc(schema.journalPosts.createdAt))
            .limit(filters.limit)
            .offset((filters.page - 1) * filters.limit),
          this.db.select({ count: count() }).from(schema.journalPosts).where(whereClause),
        ]);

        return {
          posts: posts.map((row) => this.mapRow(row)),
          total: countResult[0]?.count ?? 0,
        };
      },
      { filters },
    );
  }

  /**
   * Finds a published post by slug.
   * Only returns posts that are not drafts and have publishedAt <= now.
   *
   * @param slug - Post slug
   * @returns Post or null if not found/not visible
   */
  async findBySlug(slug: string): Promise<JournalPost | null> {
    return withDbError(
      'find post by slug',
      this.logger,
      async () => {
        const now = new Date();
        const [row] = await this.db
          .select()
          .from(schema.journalPosts)
          .where(
            and(
              eq(schema.journalPosts.slug, slug),
              eq(schema.journalPosts.isDraft, false),
              lte(schema.journalPosts.publishedAt, now),
            ),
          );
        return row ? this.mapRow(row) : null;
      },
      { slug },
    );
  }

  /**
   * Finds a post by ID (for admin use - includes drafts).
   *
   * @param id - Post ID
   * @returns Post or null if not found
   */
  async findById(id: string): Promise<JournalPost | null> {
    return withDbError(
      'find post by id',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.journalPosts)
          .where(eq(schema.journalPosts.id, id));
        return row ? this.mapRow(row) : null;
      },
      { id },
    );
  }

  /**
   * Finds the most recent published post for a given context.
   * Used for context links from product features.
   *
   * @param contextId - Context identifier
   * @returns Most recent post for context or null
   */
  async findByContext(contextId: string): Promise<JournalPost | null> {
    return withDbError(
      'find post by context',
      this.logger,
      async () => {
        const now = new Date();
        const [row] = await this.db
          .select()
          .from(schema.journalPosts)
          .where(
            and(
              eq(schema.journalPosts.contextId, contextId),
              eq(schema.journalPosts.isDraft, false),
              lte(schema.journalPosts.publishedAt, now),
            ),
          )
          .orderBy(desc(schema.journalPosts.publishedAt), desc(schema.journalPosts.createdAt))
          .limit(1);
        return row ? this.mapRow(row) : null;
      },
      { contextId },
    );
  }

  /**
   * Checks if a slug already exists.
   *
   * @param slug - Slug to check
   * @param excludeId - Optional ID to exclude (for updates)
   * @returns True if slug exists
   */
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    return withDbError(
      'check slug exists',
      this.logger,
      async () => {
        const conditions = [eq(schema.journalPosts.slug, slug)];
        if (excludeId) {
          conditions.push(sql`${schema.journalPosts.id} != ${excludeId}`);
        }

        const [result] = await this.db
          .select({ count: count() })
          .from(schema.journalPosts)
          .where(and(...conditions));

        return (result?.count ?? 0) > 0;
      },
      { slug, excludeId },
    );
  }

  /**
   * Creates a new journal post.
   *
   * @param data - Post creation data
   * @returns Created post
   */
  async create(data: CreateJournalPostData): Promise<JournalPost> {
    return withDbError(
      'create journal post',
      this.logger,
      async () => {
        const [row] = await this.db
          .insert(schema.journalPosts)
          .values({
            slug: data.slug,
            title: data.title,
            body: data.body,
            bodyHtml: data.bodyHtml,
            excerpt: data.excerpt,
            type: data.type,
            featuredImageUrl: data.featuredImageUrl ?? null,
            contextId: data.contextId ?? null,
            metaTitle: data.metaTitle ?? null,
            metaDescription: data.metaDescription ?? null,
            isDraft: data.isDraft,
            publishedAt: data.publishedAt ?? null,
            authorId: data.authorId,
          })
          .returning();
        return this.mapRow(row);
      },
      { slug: data.slug },
    );
  }

  /**
   * Updates an existing journal post.
   *
   * @param id - Post ID
   * @param data - Update data
   * @returns Updated post or null if not found
   */
  async update(id: string, data: UpdateJournalPostData): Promise<JournalPost | null> {
    return withDbError(
      'update journal post',
      this.logger,
      async () => {
        const updatePayload: Partial<typeof schema.journalPosts.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (data.slug !== undefined) updatePayload.slug = data.slug;
        if (data.title !== undefined) updatePayload.title = data.title;
        if (data.body !== undefined) updatePayload.body = data.body;
        if (data.bodyHtml !== undefined) updatePayload.bodyHtml = data.bodyHtml;
        if (data.excerpt !== undefined) updatePayload.excerpt = data.excerpt;
        if (data.type !== undefined) updatePayload.type = data.type;
        if (data.featuredImageUrl !== undefined)
          updatePayload.featuredImageUrl = data.featuredImageUrl;
        if (data.contextId !== undefined) updatePayload.contextId = data.contextId;
        if (data.metaTitle !== undefined) updatePayload.metaTitle = data.metaTitle;
        if (data.metaDescription !== undefined)
          updatePayload.metaDescription = data.metaDescription;
        if (data.isDraft !== undefined) updatePayload.isDraft = data.isDraft;
        if (data.publishedAt !== undefined) updatePayload.publishedAt = data.publishedAt;

        const [row] = await this.db
          .update(schema.journalPosts)
          .set(updatePayload)
          .where(eq(schema.journalPosts.id, id))
          .returning();

        return row ? this.mapRow(row) : null;
      },
      { id },
    );
  }

  /**
   * Deletes a journal post.
   *
   * @param id - Post ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return withDbError(
      'delete journal post',
      this.logger,
      async () => {
        const result = await this.db
          .delete(schema.journalPosts)
          .where(eq(schema.journalPosts.id, id))
          .returning({ id: schema.journalPosts.id });

        return result.length > 0;
      },
      { id },
    );
  }

  /**
   * Gets navigation links (prev/next) for a post.
   * Uses composite comparison (publishedAt, createdAt) for stable ordering.
   *
   * @param currentPost - Current post to get navigation for
   * @returns Navigation with prev/next links
   */
  async getNavigation(currentPost: JournalPost): Promise<PostNavigation> {
    return withDbError(
      'get post navigation',
      this.logger,
      async () => {
        const now = new Date();

        // Only get navigation if the post has a publishedAt date
        if (!currentPost.publishedAt) {
          return { prev: null, next: null };
        }

        const [prevResult, nextResult] = await Promise.all([
          // Previous: most recent post published BEFORE current
          // Uses composite comparison for tie-breaker
          this.db
            .select({
              slug: schema.journalPosts.slug,
              title: schema.journalPosts.title,
            })
            .from(schema.journalPosts)
            .where(
              and(
                ne(schema.journalPosts.id, currentPost.id),
                eq(schema.journalPosts.isDraft, false),
                lte(schema.journalPosts.publishedAt, now),
                or(
                  lt(schema.journalPosts.publishedAt, currentPost.publishedAt),
                  and(
                    eq(schema.journalPosts.publishedAt, currentPost.publishedAt),
                    lt(schema.journalPosts.createdAt, currentPost.createdAt),
                  ),
                ),
              ),
            )
            .orderBy(desc(schema.journalPosts.publishedAt), desc(schema.journalPosts.createdAt))
            .limit(1),
          // Next: oldest post published AFTER current
          // Uses composite comparison for tie-breaker
          this.db
            .select({
              slug: schema.journalPosts.slug,
              title: schema.journalPosts.title,
            })
            .from(schema.journalPosts)
            .where(
              and(
                ne(schema.journalPosts.id, currentPost.id),
                eq(schema.journalPosts.isDraft, false),
                lte(schema.journalPosts.publishedAt, now),
                or(
                  gt(schema.journalPosts.publishedAt, currentPost.publishedAt),
                  and(
                    eq(schema.journalPosts.publishedAt, currentPost.publishedAt),
                    gt(schema.journalPosts.createdAt, currentPost.createdAt),
                  ),
                ),
              ),
            )
            .orderBy(asc(schema.journalPosts.publishedAt), asc(schema.journalPosts.createdAt))
            .limit(1),
        ]);

        return {
          prev: prevResult[0] ?? null,
          next: nextResult[0] ?? null,
        };
      },
      { postId: currentPost.id },
    );
  }

  /**
   * Finds all posts for admin (includes drafts).
   * Supports 'scheduled' status: published (not draft) posts with publishedAt > now.
   *
   * @param filters - Pagination and status filter options
   * @returns Paginated posts and total count
   */
  async findAll(filters: {
    page: number;
    limit: number;
    status?: 'draft' | 'published' | 'scheduled';
  }): Promise<PaginatedPostsResult> {
    return withDbError(
      'find all posts',
      this.logger,
      async () => {
        const now = new Date();
        const conditions: ReturnType<typeof eq | typeof gt>[] = [];

        if (filters.status === 'draft') {
          conditions.push(eq(schema.journalPosts.isDraft, true));
        } else if (filters.status === 'published') {
          // Published: not a draft AND publishedAt <= now (already visible)
          conditions.push(eq(schema.journalPosts.isDraft, false));
          conditions.push(lte(schema.journalPosts.publishedAt, now));
        } else if (filters.status === 'scheduled') {
          // Scheduled: not a draft AND publishedAt > now (future publication)
          conditions.push(eq(schema.journalPosts.isDraft, false));
          conditions.push(gt(schema.journalPosts.publishedAt, now));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [posts, countResult] = await Promise.all([
          this.db
            .select()
            .from(schema.journalPosts)
            .where(whereClause)
            .orderBy(desc(schema.journalPosts.updatedAt))
            .limit(filters.limit)
            .offset((filters.page - 1) * filters.limit),
          this.db.select({ count: count() }).from(schema.journalPosts).where(whereClause),
        ]);

        return {
          posts: posts.map((row) => this.mapRow(row)),
          total: countResult[0]?.count ?? 0,
        };
      },
      { filters },
    );
  }

  /**
   * Maps a database row to a JournalPost domain entity.
   */
  private mapRow(row: typeof schema.journalPosts.$inferSelect): JournalPost {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      body: row.body,
      bodyHtml: row.bodyHtml,
      excerpt: row.excerpt,
      type: row.type,
      featuredImageUrl: row.featuredImageUrl,
      contextId: row.contextId,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      isDraft: row.isDraft,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authorId: row.authorId,
    };
  }
}
