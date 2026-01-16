import type { ReviewVote, UpsertVoteInput } from '../entities/review-vote.entity';

export const REVIEW_VOTE_REPOSITORY = Symbol('REVIEW_VOTE_REPOSITORY');

/**
 * Repository interface for review votes.
 */
export interface IReviewVoteRepository {
  /**
   * Find a vote by user and review.
   */
  findByUserAndReview(userId: string, reviewId: string): Promise<ReviewVote | null>;

  /**
   * Upsert a vote (create or update).
   */
  upsert(input: UpsertVoteInput): Promise<ReviewVote>;

  /**
   * Remove a vote.
   */
  remove(userId: string, reviewId: string): Promise<boolean>;

  /**
   * Count votes by review (for denormalization).
   */
  countByReview(reviewId: string): Promise<{ likes: number; dislikes: number }>;

  /**
   * Find user's vote for multiple reviews (batch).
   */
  findUserVotesForReviews(userId: string, reviewIds: string[]): Promise<Map<string, ReviewVote>>;
}
