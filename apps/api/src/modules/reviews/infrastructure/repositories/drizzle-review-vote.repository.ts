import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions/database.exception';
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
    try {
      const [row] = await this.db
        .select()
        .from(schema.reviewVotes)
        .where(
          and(eq(schema.reviewVotes.userId, userId), eq(schema.reviewVotes.reviewId, reviewId)),
        )
        .limit(1);

      return row ? this.mapRow(row) : null;
    } catch (error) {
      this.logger.error(`findByUserAndReview failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to find vote', { userId, reviewId });
    }
  }

  /**
   * Upsert a vote (create or update).
   */
  async upsert(input: UpsertVoteInput): Promise<ReviewVote> {
    try {
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
    } catch (error) {
      this.logger.error(`upsert failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to upsert vote', {
        userId: input.userId,
        reviewId: input.reviewId,
      });
    }
  }

  /**
   * Remove a vote.
   */
  async remove(userId: string, reviewId: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(schema.reviewVotes)
        .where(
          and(eq(schema.reviewVotes.userId, userId), eq(schema.reviewVotes.reviewId, reviewId)),
        )
        .returning({ id: schema.reviewVotes.id });

      return result.length > 0;
    } catch (error) {
      this.logger.error(`remove failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to remove vote', { userId, reviewId });
    }
  }

  /**
   * Count votes by review (for denormalization).
   */
  async countByReview(reviewId: string): Promise<{ likes: number; dislikes: number }> {
    try {
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
    } catch (error) {
      this.logger.error(`countByReview failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to count votes', { reviewId });
    }
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

    try {
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
    } catch (error) {
      this.logger.error(`findUserVotesForReviews failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to find user votes for reviews', {
        userId,
        reviewIds: reviewIds.length,
      });
    }
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
