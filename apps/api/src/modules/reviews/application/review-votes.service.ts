import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { type VoteType } from '../domain/constants/review.constants';
import type { ReviewVote, VoteResult } from '../domain/entities/review-vote.entity';
import {
  REVIEW_VOTE_REPOSITORY,
  type IReviewVoteRepository,
} from '../domain/repositories/review-vote.repository.interface';
import {
  REVIEW_REPOSITORY,
  type IReviewRepository,
} from '../domain/repositories/review.repository.interface';

/**
 * Application service for review voting use cases.
 */
@Injectable()
export class ReviewVotesService {
  private readonly logger = new Logger(ReviewVotesService.name);

  constructor(
    @Inject(REVIEW_VOTE_REPOSITORY)
    private readonly voteRepo: IReviewVoteRepository,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepo: IReviewRepository,
  ) {}

  /**
   * Votes on a review (like or dislike).
   * If the user already voted, updates the vote type.
   * Returns the action taken and the new vote state.
   */
  async vote(userId: string, reviewId: string, voteType: VoteType): Promise<VoteResult> {
    // Check review exists
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    // Don't allow voting on own reviews
    if (review.userId === userId) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'You cannot vote on your own review',
        HttpStatus.FORBIDDEN,
        { reviewId },
      );
    }

    // Check existing vote
    const existingVote = await this.voteRepo.findByUserAndReview(userId, reviewId);

    let action: 'added' | 'changed';

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Same vote type - no change needed
        return { action: 'added', newVote: existingVote };
      }
      action = 'changed';
    } else {
      action = 'added';
    }

    // Atomically upsert vote and recount (prevents race conditions)
    const { vote: newVote } = await this.voteRepo.upsertAndRecount({ userId, reviewId, voteType });

    this.logger.log(`User ${userId} ${action} vote on review ${reviewId}: ${voteType}`);

    return { action, newVote };
  }

  /**
   * Removes a vote from a review.
   */
  async unvote(userId: string, reviewId: string): Promise<VoteResult> {
    // Check review exists
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    const { removed } = await this.voteRepo.removeAndRecount(userId, reviewId);

    if (removed) {
      this.logger.log(`User ${userId} removed vote from review ${reviewId}`);
    }

    return {
      action: 'removed',
      newVote: null,
    };
  }

  /**
   * Gets the user's vote for a specific review.
   */
  async getUserVote(userId: string, reviewId: string): Promise<ReviewVote | null> {
    return this.voteRepo.findByUserAndReview(userId, reviewId);
  }

  /**
   * Gets the user's votes for multiple reviews (batch).
   * Useful for displaying vote status on a list of reviews.
   */
  async getUserVotesForReviews(
    userId: string,
    reviewIds: string[],
  ): Promise<Map<string, ReviewVote>> {
    return this.voteRepo.findUserVotesForReviews(userId, reviewIds);
  }
}
