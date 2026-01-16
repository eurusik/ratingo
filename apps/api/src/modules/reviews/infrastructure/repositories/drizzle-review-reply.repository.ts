import { Injectable, Inject } from '@nestjs/common';

import { eq, and, asc, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

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
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findByReview(reviewId: string): Promise<ReviewReplyWithAuthor[]> {
    const rows = await this.db
      .select({
        id: reviewReplies.id,
        reviewId: reviewReplies.reviewId,
        userId: reviewReplies.userId,
        parentReplyId: reviewReplies.parentReplyId,
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
  }

  async findById(id: string): Promise<ReviewReply | null> {
    const rows = await this.db
      .select()
      .from(reviewReplies)
      .where(eq(reviewReplies.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async create(input: CreateReplyInput): Promise<ReviewReply> {
    const now = new Date();
    const [reply] = await this.db
      .insert(reviewReplies)
      .values({
        reviewId: input.reviewId,
        userId: input.userId,
        parentReplyId: input.parentReplyId ?? null,
        content: input.content,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return reply;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(reviewReplies)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(reviewReplies.id, id));
  }

  async countByReview(reviewId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewReplies)
      .where(and(eq(reviewReplies.reviewId, reviewId), eq(reviewReplies.isDeleted, false)));

    return result?.count ?? 0;
  }

  async getNestingDepth(replyId: string): Promise<number> {
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
  }
}
