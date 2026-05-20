import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, asc, eq, sql, gte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { REVIEW_SORT, type ReviewSort } from '../../domain/constants/review.constants';
import type {
  Review,
  ReviewWithAuthor,
  CreateReviewInput,
  UpdateReviewInput,
} from '../../domain/entities/review.entity';
import type {
  IReviewRepository,
  ReviewListOptions,
} from '../../domain/repositories/review.repository.interface';

/**
 * Drizzle implementation of review repository.
 */
@Injectable()
export class DrizzleReviewRepository implements IReviewRepository {
  private readonly logger = new Logger(DrizzleReviewRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Find reviews for a media item with author info.
   */
  async findByMediaItem(options: ReviewListOptions): Promise<{
    reviews: ReviewWithAuthor[];
    total: number;
  }> {
    const { mediaItemId, sort, limit, offset, hideSpoilers } = options;

    return withDbError(
      'find reviews',
      this.logger,
      async () => {
        // Build where conditions
        const conditions = [
          eq(schema.reviews.mediaItemId, mediaItemId),
          eq(schema.reviews.isDeleted, false),
        ];

        if (hideSpoilers) {
          conditions.push(eq(schema.reviews.hasSpoiler, false));
        }

        // Build order by based on sort
        const orderBy = this.getOrderBy(sort);

        // Query reviews with authors
        const rows = await this.db
          .select({
            review: schema.reviews,
            author: {
              id: schema.users.id,
              username: schema.users.username,
              avatarUrl: schema.users.avatarUrl,
              showRatings: schema.users.showRatings,
              isProfilePublic: schema.users.isProfilePublic,
            },
          })
          .from(schema.reviews)
          .innerJoin(schema.users, eq(schema.users.id, schema.reviews.userId))
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset);

        // Count total
        const [countRow] = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.reviews)
          .where(and(...conditions));

        return {
          reviews: rows.map((row) => this.mapRowWithAuthor(row.review, row.author)),
          total: Number(countRow?.count ?? 0),
        };
      },
      { mediaItemId },
    );
  }

  /**
   * Find a single review by ID.
   */
  async findById(id: string): Promise<Review | null> {
    return withDbError(
      'find review',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.reviews)
          .where(and(eq(schema.reviews.id, id), eq(schema.reviews.isDeleted, false)))
          .limit(1);

        return row ? this.mapRow(row) : null;
      },
      { id },
    );
  }

  /**
   * Find a single review by ID with author info.
   */
  async findByIdWithAuthor(id: string): Promise<ReviewWithAuthor | null> {
    return withDbError(
      'find review with author',
      this.logger,
      async () => {
        const [row] = await this.db
          .select({
            review: schema.reviews,
            author: {
              id: schema.users.id,
              username: schema.users.username,
              avatarUrl: schema.users.avatarUrl,
              showRatings: schema.users.showRatings,
              isProfilePublic: schema.users.isProfilePublic,
            },
          })
          .from(schema.reviews)
          .innerJoin(schema.users, eq(schema.users.id, schema.reviews.userId))
          .where(and(eq(schema.reviews.id, id), eq(schema.reviews.isDeleted, false)))
          .limit(1);

        return row ? this.mapRowWithAuthor(row.review, row.author) : null;
      },
      { id },
    );
  }

  /**
   * Find a review by user and media item.
   */
  async findByUserAndMedia(userId: string, mediaItemId: string): Promise<Review | null> {
    return withDbError(
      'find user review',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.reviews)
          .where(
            and(
              eq(schema.reviews.userId, userId),
              eq(schema.reviews.mediaItemId, mediaItemId),
              eq(schema.reviews.isDeleted, false),
            ),
          )
          .limit(1);

        return row ? this.mapRow(row) : null;
      },
      { userId, mediaItemId },
    );
  }

  /**
   * Create a new review.
   */
  async create(input: CreateReviewInput): Promise<Review> {
    return withDbError(
      'create review',
      this.logger,
      async () => {
        const [row] = await this.db
          .insert(schema.reviews)
          .values({
            userId: input.userId,
            mediaItemId: input.mediaItemId,
            content: input.content,
            rating: input.rating,
            hasSpoiler: input.hasSpoiler,
          })
          .returning();

        return this.mapRow(row);
      },
      { userId: input.userId, mediaItemId: input.mediaItemId },
    );
  }

  /**
   * Update an existing review.
   */
  async update(id: string, input: UpdateReviewInput): Promise<Review> {
    return withDbError(
      'update review',
      this.logger,
      async () => {
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (input.content !== undefined) updateData.content = input.content;
        if (input.rating !== undefined) updateData.rating = input.rating;
        if (input.hasSpoiler !== undefined) updateData.hasSpoiler = input.hasSpoiler;

        const [row] = await this.db
          .update(schema.reviews)
          .set(updateData)
          .where(eq(schema.reviews.id, id))
          .returning();

        if (!row) {
          throw new DatabaseException('Review not found during update', { id });
        }

        return this.mapRow(row);
      },
      { id },
    );
  }

  /**
   * Soft delete a review.
   */
  async softDelete(id: string): Promise<void> {
    return withDbError(
      'soft delete review',
      this.logger,
      () =>
        this.db
          .update(schema.reviews)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.reviews.id, id))
          .then(() => undefined),
      { id },
    );
  }

  /**
   * Hard delete a review (admin only).
   */
  async hardDelete(id: string): Promise<void> {
    return withDbError(
      'hard delete review',
      this.logger,
      () =>
        this.db
          .delete(schema.reviews)
          .where(eq(schema.reviews.id, id))
          .then(() => undefined),
      { id },
    );
  }

  /**
   * Count reviews created by user today (for rate limiting).
   */
  async countUserReviewsToday(userId: string): Promise<number> {
    return withDbError(
      'count user reviews today',
      this.logger,
      async () => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [row] = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.reviews)
          .where(and(eq(schema.reviews.userId, userId), gte(schema.reviews.createdAt, todayStart)));

        return Number(row?.count ?? 0);
      },
      { userId },
    );
  }

  /**
   * Update vote counts on a review.
   */
  async updateVoteCounts(
    reviewId: string,
    counts: { likesCount: number; dislikesCount: number },
  ): Promise<void> {
    return withDbError(
      'update vote counts',
      this.logger,
      () =>
        this.db
          .update(schema.reviews)
          .set({
            likesCount: counts.likesCount,
            dislikesCount: counts.dislikesCount,
            updatedAt: new Date(),
          })
          .where(eq(schema.reviews.id, reviewId))
          .then(() => undefined),
      { reviewId },
    );
  }

  /**
   * Increment replies count on a review.
   */
  async incrementRepliesCount(reviewId: string): Promise<void> {
    return withDbError(
      'increment replies count',
      this.logger,
      () =>
        this.db
          .update(schema.reviews)
          .set({
            repliesCount: sql`${schema.reviews.repliesCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.reviews.id, reviewId))
          .then(() => undefined),
      { reviewId },
    );
  }

  /**
   * Decrement replies count on a review.
   */
  async decrementRepliesCount(reviewId: string): Promise<void> {
    return withDbError(
      'decrement replies count',
      this.logger,
      () =>
        this.db
          .update(schema.reviews)
          .set({
            repliesCount: sql`GREATEST(${schema.reviews.repliesCount} - 1, 0)`,
            updatedAt: new Date(),
          })
          .where(eq(schema.reviews.id, reviewId))
          .then(() => undefined),
      { reviewId },
    );
  }

  private getOrderBy(sort: ReviewSort) {
    switch (sort) {
      case REVIEW_SORT.OLDEST:
        return asc(schema.reviews.createdAt);
      case REVIEW_SORT.MOST_LIKED:
        return desc(schema.reviews.likesCount);
      case REVIEW_SORT.NEWEST:
      default:
        return desc(schema.reviews.createdAt);
    }
  }

  private mapRow(row: typeof schema.reviews.$inferSelect): Review {
    return {
      id: row.id,
      userId: row.userId,
      mediaItemId: row.mediaItemId,
      content: row.content,
      rating: row.rating,
      hasSpoiler: row.hasSpoiler,
      isDeleted: row.isDeleted,
      likesCount: row.likesCount,
      dislikesCount: row.dislikesCount,
      repliesCount: row.repliesCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  private mapRowWithAuthor(
    review: typeof schema.reviews.$inferSelect,
    author: {
      id: string;
      username: string;
      avatarUrl: string | null;
      showRatings: boolean;
      isProfilePublic: boolean;
    },
  ): ReviewWithAuthor {
    return {
      ...this.mapRow(review),
      author: {
        id: author.id,
        username: author.username,
        avatarUrl: author.avatarUrl,
        showRatings: author.showRatings,
        isProfilePublic: author.isProfilePublic,
      },
    };
  }
}
