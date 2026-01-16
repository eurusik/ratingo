import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../common/constants';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { REVIEW_LIMITS, REVIEW_SORT, type ReviewSort } from '../domain/constants/review.constants';
import type {
  Review,
  ReviewWithAuthor,
  CreateReviewInput,
  UpdateReviewInput,
} from '../domain/entities/review.entity';
import {
  REVIEW_REPOSITORY,
  type IReviewRepository,
  type ReviewListOptions,
} from '../domain/repositories/review.repository.interface';

/**
 * Payload for creating a review from controller.
 */
export interface CreateReviewPayload {
  userId: string;
  mediaItemId: string;
  content: string;
  rating: number;
  hasSpoiler?: boolean;
}

/**
 * Payload for updating a review from controller.
 */
export interface UpdateReviewPayload {
  content?: string;
  rating?: number;
  hasSpoiler?: boolean;
}

/**
 * Query options for listing reviews.
 */
export interface ListReviewsOptions {
  mediaItemId: string;
  sort?: ReviewSort;
  limit?: number;
  offset?: number;
  hideSpoilers?: boolean;
}

/**
 * Application service for review use cases.
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepo: IReviewRepository,
  ) {}

  /**
   * Lists reviews for a media item with author info.
   */
  async listForMedia(options: ListReviewsOptions): Promise<{
    reviews: ReviewWithAuthor[];
    total: number;
  }> {
    const listOptions: ReviewListOptions = {
      mediaItemId: options.mediaItemId,
      sort: options.sort ?? REVIEW_SORT.NEWEST,
      limit: Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
      offset: options.offset ?? 0,
      hideSpoilers: options.hideSpoilers,
    };

    return this.reviewRepo.findByMediaItem(listOptions);
  }

  /**
   * Gets a single review by ID with author info.
   */
  async getById(reviewId: string): Promise<ReviewWithAuthor> {
    const review = await this.reviewRepo.findByIdWithAuthor(reviewId);

    if (!review) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    return review;
  }

  /**
   * Gets a user's review for a specific media item.
   */
  async getUserReviewForMedia(userId: string, mediaItemId: string): Promise<Review | null> {
    return this.reviewRepo.findByUserAndMedia(userId, mediaItemId);
  }

  /**
   * Creates a new review.
   * Enforces one review per user per media item and rate limiting.
   */
  async create(payload: CreateReviewPayload): Promise<Review> {
    const { userId, mediaItemId, content, rating, hasSpoiler } = payload;

    // Check if user already has a review for this media
    const existing = await this.reviewRepo.findByUserAndMedia(userId, mediaItemId);
    if (existing) {
      throw new AppException(
        ErrorCode.REVIEW_ALREADY_EXISTS,
        'You already have a review for this title',
        HttpStatus.CONFLICT,
        { reviewId: existing.id },
      );
    }

    // Check rate limiting
    const todayCount = await this.reviewRepo.countUserReviewsToday(userId);
    if (todayCount >= REVIEW_LIMITS.RATE_LIMIT_REVIEWS_PER_DAY) {
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        `You can create up to ${REVIEW_LIMITS.RATE_LIMIT_REVIEWS_PER_DAY} reviews per day`,
        HttpStatus.TOO_MANY_REQUESTS,
        { limit: REVIEW_LIMITS.RATE_LIMIT_REVIEWS_PER_DAY, current: todayCount },
      );
    }

    const input: CreateReviewInput = {
      userId,
      mediaItemId,
      content: content.trim(),
      rating,
      hasSpoiler: hasSpoiler ?? false,
    };

    const review = await this.reviewRepo.create(input);

    this.logger.log(`User ${userId} created review ${review.id} for media ${mediaItemId}`);

    return review;
  }

  /**
   * Updates an existing review.
   * Only the author can update their review.
   */
  async update(reviewId: string, userId: string, payload: UpdateReviewPayload): Promise<Review> {
    const review = await this.reviewRepo.findById(reviewId);

    if (!review) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    if (review.userId !== userId) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'You can only update your own reviews',
        HttpStatus.FORBIDDEN,
        { reviewId },
      );
    }

    const input: UpdateReviewInput = {};
    if (payload.content !== undefined) {
      input.content = payload.content.trim();
    }
    if (payload.rating !== undefined) {
      input.rating = payload.rating;
    }
    if (payload.hasSpoiler !== undefined) {
      input.hasSpoiler = payload.hasSpoiler;
    }

    const updated = await this.reviewRepo.update(reviewId, input);

    this.logger.log(`User ${userId} updated review ${reviewId}`);

    return updated;
  }

  /**
   * Soft deletes a review.
   * Only the author can delete their review.
   */
  async delete(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewRepo.findById(reviewId);

    if (!review) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    if (review.userId !== userId) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'You can only delete your own reviews',
        HttpStatus.FORBIDDEN,
        { reviewId },
      );
    }

    await this.reviewRepo.softDelete(reviewId);

    this.logger.log(`User ${userId} deleted review ${reviewId}`);
  }

  /**
   * Hard deletes a review (admin only).
   */
  async hardDelete(reviewId: string): Promise<void> {
    const review = await this.reviewRepo.findById(reviewId);

    if (!review) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    await this.reviewRepo.hardDelete(reviewId);

    this.logger.log(`Admin hard deleted review ${reviewId}`);
  }

  /**
   * Soft deletes a review regardless of ownership (admin only).
   */
  async forceDelete(reviewId: string): Promise<void> {
    const review = await this.reviewRepo.findById(reviewId);

    if (!review) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    await this.reviewRepo.softDelete(reviewId);

    this.logger.log(`Admin force deleted review ${reviewId}`);
  }
}
