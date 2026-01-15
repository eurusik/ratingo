import type { VoteType } from '../constants/review.constants';

/**
 * Vote on a review (like or dislike).
 */
export interface ReviewVote {
  id: string;
  reviewId: string;
  userId: string;
  voteType: VoteType;
  createdAt: Date;
}

/**
 * Input for creating/updating a vote.
 */
export interface UpsertVoteInput {
  reviewId: string;
  userId: string;
  voteType: VoteType;
}

/**
 * Result of a vote operation.
 */
export interface VoteResult {
  action: 'added' | 'changed' | 'removed';
  newVote: ReviewVote | null;
}
