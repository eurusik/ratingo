import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { REVIEW_LIMITS } from '../domain/constants/review.constants';
import type { ReviewReply, ReviewReplyWithAuthor } from '../domain/entities/review-reply.entity';
import {
  REVIEW_REPLY_REPOSITORY,
  type IReviewReplyRepository,
} from '../domain/repositories/review-reply.repository.interface';
import {
  REVIEW_REPOSITORY,
  type IReviewRepository,
} from '../domain/repositories/review.repository.interface';

/**
 * Payload for creating a reply from controller.
 */
export interface CreateReplyPayload {
  userId: string;
  reviewId: string;
  parentReplyId?: string | null;
  content: string;
}

/**
 * Application service for review replies.
 */
@Injectable()
export class ReviewRepliesService {
  private readonly logger = new Logger(ReviewRepliesService.name);

  constructor(
    @Inject(REVIEW_REPLY_REPOSITORY)
    private readonly replyRepo: IReviewReplyRepository,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepo: IReviewRepository,
  ) {}

  /**
   * Lists replies for a review with author info.
   */
  async listForReview(reviewId: string): Promise<ReviewReplyWithAuthor[]> {
    // Verify review exists
    const review = await this.reviewRepo.findById(reviewId);
    if (!review || review.isDeleted) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    return this.replyRepo.findByReview(reviewId);
  }

  /**
   * Creates a new reply.
   * Enforces max nesting depth.
   */
  async create(payload: CreateReplyPayload): Promise<ReviewReply> {
    const { userId, reviewId, parentReplyId, content } = payload;

    // Verify review exists
    const review = await this.reviewRepo.findById(reviewId);
    if (!review || review.isDeleted) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    // Check nesting depth if replying to another reply
    if (parentReplyId) {
      const parentReply = await this.replyRepo.findById(parentReplyId);
      if (!parentReply || parentReply.isDeleted) {
        throw new NotFoundException(ErrorCode.REPLY_NOT_FOUND, 'Parent reply not found', {
          parentReplyId,
        });
      }

      // Verify parent belongs to the same review
      if (parentReply.reviewId !== reviewId) {
        throw new AppException(
          ErrorCode.INVALID_INPUT,
          'Parent reply does not belong to this review',
          HttpStatus.BAD_REQUEST,
          { reviewId, parentReplyId },
        );
      }

      // Check nesting depth (parent depth + 1 for this reply)
      const parentDepth = await this.replyRepo.getNestingDepth(parentReplyId);
      if (parentDepth + 1 >= REVIEW_LIMITS.MAX_REPLIES_DEPTH) {
        throw new AppException(
          ErrorCode.REPLY_MAX_DEPTH_EXCEEDED,
          `Maximum nesting depth is ${REVIEW_LIMITS.MAX_REPLIES_DEPTH}`,
          HttpStatus.BAD_REQUEST,
          { maxDepth: REVIEW_LIMITS.MAX_REPLIES_DEPTH, currentDepth: parentDepth + 1 },
        );
      }
    }

    const reply = await this.replyRepo.create({
      userId,
      reviewId,
      parentReplyId: parentReplyId ?? null,
      content: content.trim(),
    });

    // Increment replies count on review
    await this.reviewRepo.incrementRepliesCount(reviewId);

    this.logger.log(`User ${userId} created reply ${reply.id} for review ${reviewId}`);

    return reply;
  }

  /**
   * Deletes a reply.
   * Only the author can delete their reply.
   */
  async delete(replyId: string, userId: string): Promise<void> {
    const reply = await this.replyRepo.findById(replyId);

    if (!reply || reply.isDeleted) {
      throw new NotFoundException(ErrorCode.REPLY_NOT_FOUND, 'Reply not found', { replyId });
    }

    if (reply.userId !== userId) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'You can only delete your own replies',
        HttpStatus.FORBIDDEN,
        { replyId },
      );
    }

    await this.replyRepo.softDelete(replyId);

    // Decrement replies count on review
    await this.reviewRepo.decrementRepliesCount(reply.reviewId);

    this.logger.log(`User ${userId} deleted reply ${replyId}`);
  }
}
