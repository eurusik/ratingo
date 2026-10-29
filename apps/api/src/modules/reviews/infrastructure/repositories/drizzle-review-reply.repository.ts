import { Injectable, Inject, Logger } from '@nestjs/common';

import { eq, and, asc, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { reviewReplies, users } from '../../../../database/schema';
import type {
  ReviewReply,
  ReviewReplyWithAuthor,
  CreateReplyInput,
} from '../../domain/entities/review-reply.entity';
import type { IReviewReplyRepository } from '../../domain/repositories/review-reply.repository.interface';

@Injectable()
export class DrizzleReviewReplyRepository implements IReviewReplyRepository {
  private readonly logger = new Logger(DrizzleReviewReplyRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findByReview(reviewId: string): Promise<ReviewReplyWithAuthor[]> {
    return withDbError(
      'find replies by review',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            id: reviewReplies.id,
            reviewId: reviewReplies.reviewId,
            userId: reviewReplies.userId,
            parentReplyId: reviewReplies.parentReplyId,
            replyToUsername: reviewReplies.replyToUsername,
            content: reviewReplies.content,
            isDeleted: reviewReplies.isDeleted,
            createdAt: reviewReplies.createdAt,
            updatedAt: reviewReplies.updatedAt,
            authorId: users.id,
            authorUsername: users.username,
            authorAvatarUrl: users.avatarUrl,
            authorIsProfilePublic: users.isProfilePublic,
          })
          .from(reviewReplies)
          .innerJoin(users, eq(reviewReplies.userId, users.id))
          .where(and(eq(reviewReplies.reviewId, reviewId), eq(reviewReplies.isDeleted, false)))
          .orderBy(asc(reviewReplies.createdAt));

        return rows.map((row) => ({
          id: row.id,
          reviewId: row.reviewId,
          userId: row.userId,
          parentReplyId: row.parentReplyId,
          replyToUsername: row.replyToUsername,
          content: row.content,
          isDeleted: row.isDeleted,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          author: {
            id: row.authorId,
            username: row.authorUsername,
            avatarUrl: row.authorAvatarUrl,
            isProfilePublic: row.authorIsProfilePublic ?? true,
          },
        }));
      },
      { reviewId },
    );
  }

  async findById(id: string): Promise<ReviewReply | null> {
    return withDbError(
      'find reply by ID',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(reviewReplies)
          .where(eq(reviewReplies.id, id))
          .limit(1);

        return rows[0] ?? null;
      },
      { id },
    );
  }

  /**
   * Creates a reply and increments the review's replies count in one transaction.
   */
  async create(input: CreateReplyInput): Promise<ReviewReply> {
    return withDbError(
      'create reply',
      this.logger,
      async () => {
        return this.db.transaction(async (tx) => {
          const now = new Date();
          const [reply] = await tx
            .insert(reviewReplies)
            .values({
              reviewId: input.reviewId,
              userId: input.userId,
              parentReplyId: input.parentReplyId ?? null,
              replyToUsername: input.replyToUsername ?? null,
              content: input.content,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          await tx
            .update(schema.reviews)
            .set({
              repliesCount: sql`${schema.reviews.repliesCount} + 1`,
              updatedAt: now,
            })
            .where(eq(schema.reviews.id, input.reviewId));

          return reply;
        });
      },
      { reviewId: input.reviewId, userId: input.userId },
    );
  }

  /**
   * Soft-deletes a reply and decrements the review's replies count in one transaction.
   * The update is conditional (`is_deleted = false`), so concurrent deletes of the same reply
   * decrement the counter at most once.
   *
   * @returns true if this call deleted the reply, false if it was already deleted/missing
   */
  async softDelete(id: string): Promise<boolean> {
    return withDbError(
      'soft delete reply',
      this.logger,
      async () => {
        return this.db.transaction(async (tx) => {
          const now = new Date();
          const [deleted] = await tx
            .update(reviewReplies)
            .set({ isDeleted: true, updatedAt: now })
            .where(and(eq(reviewReplies.id, id), eq(reviewReplies.isDeleted, false)))
            .returning({ reviewId: reviewReplies.reviewId });

          if (!deleted) return false;

          await tx
            .update(schema.reviews)
            .set({
              repliesCount: sql`GREATEST(${schema.reviews.repliesCount} - 1, 0)`,
              updatedAt: now,
            })
            .where(eq(schema.reviews.id, deleted.reviewId));

          return true;
        });
      },
      { id },
    );
  }

  async countByReview(reviewId: string): Promise<number> {
    return withDbError(
      'count replies by review',
      this.logger,
      async () => {
        const [result] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(reviewReplies)
          .where(and(eq(reviewReplies.reviewId, reviewId), eq(reviewReplies.isDeleted, false)));

        return result?.count ?? 0;
      },
      { reviewId },
    );
  }

  async getNestingDepth(replyId: string): Promise<number> {
    return withDbError(
      'get reply nesting depth',
      this.logger,
      async () => {
        // Simple depth calculation: check if parent has a parent
        // MAX_REPLIES_DEPTH is 2, so we only need to check 2 levels
        const reply = await this.findById(replyId);
        if (!reply || !reply.parentReplyId) {
          return 0; // Top-level reply
        }

        // Check if parent has a parent (depth 1 means parent is at root level)
        const parent = await this.findById(reply.parentReplyId);
        if (!parent || !parent.parentReplyId) {
          return 1; // Reply to a top-level reply
        }

        // Parent has a parent, so this reply would be at depth 2+
        return 2;
      },
      { replyId },
    );
  }
}
