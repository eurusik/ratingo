import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { VOTE_TYPE, type VoteType } from '../../domain/constants/review.constants';
import type { ReviewVote, UpsertVoteInput } from '../../domain/entities/review-vote.entity';
import type { IReviewVoteRepository } from '../../domain/repositories/review-vote.repository.interface';

/**
 * Drizzle implementation of review vote repository.
 */
@Injectable()
export class DrizzleReviewVoteRepository implements IReviewVoteRepository {
  private readonly logger = new Logger(DrizzleReviewVoteRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Find a vote by user and review.
   */
  async findByUserAndReview(userId: string, reviewId: string): Promise<ReviewVote | null> {
    return withDbError(
      'find vote',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.reviewVotes)
          .where(
            and(eq(schema.reviewVotes.userId, userId), eq(schema.reviewVotes.reviewId, reviewId)),
          )
          .limit(1);

        return row ? this.mapRow(row) : null;
      },
      { userId, reviewId },
    );
  }

  /**
   * Upsert a vote (create or update).
   */
  async upsert(input: UpsertVoteInput): Promise<ReviewVote> {
    return withDbError(
      'upsert vote',
      this.logger,
      async () => {
        const [row] = await this.db
          .insert(schema.reviewVotes)
          .values({
            userId: input.userId,
            reviewId: input.reviewId,
            voteType: input.voteType,
          })
          .onConflictDoUpdate({
            target: [schema.reviewVotes.userId, schema.reviewVotes.reviewId],
            set: {
              voteType: input.voteType,
            },
          })
          .returning();

        return this.mapRow(row);
      },
      { userId: input.userId, reviewId: input.reviewId },
    );
  }

  /**
   * Remove a vote.
   */
  async remove(userId: string, reviewId: string): Promise<boolean> {
    return withDbError(
      'remove vote',
      this.logger,
      async () => {
        const result = await this.db
          .delete(schema.reviewVotes)
          .where(
            and(eq(schema.reviewVotes.userId, userId), eq(schema.reviewVotes.reviewId, reviewId)),
          )
          .returning({ id: schema.reviewVotes.id });

        return result.length > 0;
      },
      { userId, reviewId },
    );
  }

  /**
   * Count votes by review (for denormalization).
   */
  async countByReview(reviewId: string): Promise<{ likes: number; dislikes: number }> {
    return withDbError(
      'count votes',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            voteType: schema.reviewVotes.voteType,
            count: sql<number>`count(*)`,
          })
          .from(schema.reviewVotes)
          .where(eq(schema.reviewVotes.reviewId, reviewId))
          .groupBy(schema.reviewVotes.voteType);

        let likes = 0;
        let dislikes = 0;

        for (const row of rows) {
          if (row.voteType === VOTE_TYPE.LIKE) {
            likes = Number(row.count);
          } else if (row.voteType === VOTE_TYPE.DISLIKE) {
            dislikes = Number(row.count);
          }
        }

        return { likes, dislikes };
      },
      { reviewId },
    );
  }

  /**
   * Find user's vote for multiple reviews (batch).
   */
  async findUserVotesForReviews(
    userId: string,
    reviewIds: string[],
  ): Promise<Map<string, ReviewVote>> {
    if (reviewIds.length === 0) {
      return new Map();
    }

    return withDbError(
      'find user votes for reviews',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.reviewVotes)
          .where(
            and(
              eq(schema.reviewVotes.userId, userId),
              inArray(schema.reviewVotes.reviewId, reviewIds),
            ),
          );

        const result = new Map<string, ReviewVote>();
        for (const row of rows) {
          result.set(row.reviewId, this.mapRow(row));
        }

        return result;
      },
      { userId, reviewIds: reviewIds.length },
    );
  }

  /**
   * Atomically upsert a vote and recount totals in one transaction.
   */
  async upsertAndRecount(
    input: UpsertVoteInput,
  ): Promise<{ vote: ReviewVote; counts: { likes: number; dislikes: number } }> {
    return withDbError(
      'upsert vote and recount',
      this.logger,
      async () => {
        return this.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(schema.reviewVotes)
            .values({ userId: input.userId, reviewId: input.reviewId, voteType: input.voteType })
            .onConflictDoUpdate({
              target: [schema.reviewVotes.userId, schema.reviewVotes.reviewId],
              set: { voteType: input.voteType },
            })
            .returning();

          const [updated] = await tx
            .update(schema.reviews)
            .set({
              likesCount: sql`(SELECT COUNT(*) FROM ${schema.reviewVotes} WHERE review_id = ${input.reviewId} AND vote_type = 'like')`,
              dislikesCount: sql`(SELECT COUNT(*) FROM ${schema.reviewVotes} WHERE review_id = ${input.reviewId} AND vote_type = 'dislike')`,
            })
            .where(eq(schema.reviews.id, input.reviewId))
            .returning({
              likesCount: schema.reviews.likesCount,
              dislikesCount: schema.reviews.dislikesCount,
            });

          return {
            vote: this.mapRow(row),
            counts: { likes: updated.likesCount, dislikes: updated.dislikesCount },
          };
        });
      },
      { userId: input.userId, reviewId: input.reviewId },
    );
  }

  /**
   * Atomically remove a vote and recount totals in one transaction.
   */
  async removeAndRecount(
    userId: string,
    reviewId: string,
  ): Promise<{ removed: boolean; counts: { likes: number; dislikes: number } }> {
    return withDbError(
      'remove vote and recount',
      this.logger,
      async () => {
        return this.db.transaction(async (tx) => {
          const deleted = await tx
            .delete(schema.reviewVotes)
            .where(
              and(eq(schema.reviewVotes.userId, userId), eq(schema.reviewVotes.reviewId, reviewId)),
            )
            .returning({ id: schema.reviewVotes.id });

          const [updated] = await tx
            .update(schema.reviews)
            .set({
              likesCount: sql`(SELECT COUNT(*) FROM ${schema.reviewVotes} WHERE review_id = ${reviewId} AND vote_type = 'like')`,
              dislikesCount: sql`(SELECT COUNT(*) FROM ${schema.reviewVotes} WHERE review_id = ${reviewId} AND vote_type = 'dislike')`,
            })
            .where(eq(schema.reviews.id, reviewId))
            .returning({
              likesCount: schema.reviews.likesCount,
              dislikesCount: schema.reviews.dislikesCount,
            });

          return {
            removed: deleted.length > 0,
            counts: { likes: updated.likesCount, dislikes: updated.dislikesCount },
          };
        });
      },
      { userId, reviewId },
    );
  }

  private mapRow(row: typeof schema.reviewVotes.$inferSelect): ReviewVote {
    return {
      id: row.id,
      reviewId: row.reviewId,
      userId: row.userId,
      voteType: row.voteType as VoteType,
      createdAt: row.createdAt,
    };
  }
}
