import type { ReviewSort } from '../constants/review.constants';
import type {
  Review,
  ReviewWithAuthor,
  CreateReviewInput,
  UpdateReviewInput,
} from '../entities/review.entity';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

/**
 * Query options for listing reviews.
 */
export interface ReviewListOptions {
  mediaItemId: string;
  sort: ReviewSort;
  limit: number;
  offset: number;
  hideSpoilers?: boolean;
}

/**
 * Repository interface for reviews.
 */
export interface IReviewRepository {
  /**
   * Find reviews for a media item with author info.
   */
  findByMediaItem(options: ReviewListOptions): Promise<{
    reviews: ReviewWithAuthor[];
    total: number;
  }>;

  /**
   * Find a single review by ID.
   */
  findById(id: string): Promise<Review | null>;

  /**
   * Find a single review by ID with author info.
   */
  findByIdWithAuthor(id: string): Promise<ReviewWithAuthor | null>;

  /**
   * Find a review by user and media item.
   */
  findByUserAndMedia(userId: string, mediaItemId: string): Promise<Review | null>;

  /**
   * Create a new review.
   */
  create(input: CreateReviewInput): Promise<Review>;

  /**
   * Update an existing review.
   */
  update(id: string, input: UpdateReviewInput): Promise<Review>;

  /**
   * Soft delete a review.
   */
  softDelete(id: string): Promise<void>;

  /**
   * Hard delete a review (admin only).
   */
  hardDelete(id: string): Promise<void>;

  /**
   * Count reviews created by user today (for rate limiting).
   */
  countUserReviewsToday(userId: string): Promise<number>;

  /**
   * Update vote counts on a review.
   */
  updateVoteCounts(
    reviewId: string,
    counts: { likesCount: number; dislikesCount: number },
  ): Promise<void>;

  /**
   * Increment replies count on a review.
   */
  incrementRepliesCount(reviewId: string): Promise<void>;

  /**
   * Decrement replies count on a review.
   */
  decrementRepliesCount(reviewId: string): Promise<void>;
}
