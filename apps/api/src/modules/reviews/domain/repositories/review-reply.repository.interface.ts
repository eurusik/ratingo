import type {
  ReviewReply,
  ReviewReplyWithAuthor,
  CreateReplyInput,
} from '../entities/review-reply.entity';

export const REVIEW_REPLY_REPOSITORY = Symbol('REVIEW_REPLY_REPOSITORY');

/**
 * Repository interface for review replies.
 */
export interface IReviewReplyRepository {
  /**
   * Find replies for a review with author info.
   * Ordered by createdAt ascending (oldest first).
   */
  findByReview(reviewId: string): Promise<ReviewReplyWithAuthor[]>;

  /**
   * Find a single reply by ID.
   */
  findById(id: string): Promise<ReviewReply | null>;

  /**
   * Create a new reply.
   */
  create(input: CreateReplyInput): Promise<ReviewReply>;

  /**
   * Soft delete a reply.
   */
  softDelete(id: string): Promise<void>;

  /**
   * Count replies for a review (non-deleted).
   */
  countByReview(reviewId: string): Promise<number>;

  /**
   * Get nesting depth of a reply.
   * Returns 0 for top-level replies, 1 for replies to replies.
   */
  getNestingDepth(replyId: string): Promise<number>;
}
