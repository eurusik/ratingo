import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../common/constants';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { type MediaType } from '../../../common/enums/media-type.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { RATING_SYNC_PORT, type IRatingSyncPort } from '../../user-media/public';
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
  /** Optional media type hint for correct default user-media state. */
  mediaType?: MediaType;
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
    @Inject(RATING_SYNC_PORT)
    private readonly ratingSync: IRatingSyncPort,
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
    const { userId, mediaItemId, content, rating, hasSpoiler, mediaType } = payload;

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

    await this.trySyncRating(userId, mediaItemId, rating, mediaType);

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

    if (payload.rating !== undefined) {
      // mediaType not available on update — syncRating defaults to 'completed'
      // if no user_media_state exists yet (rare: user usually has state before review)
      await this.trySyncRating(review.userId, review.mediaItemId, payload.rating);
    }

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

  /**
   * Syncs a rating from user-media state to the review aggregate.
   *
   * Called by UserMediaRatingChangedListener via domain event.
   * No-op when rating is null (cleared), no review exists, or the rating already matches.
   */
  async syncRatingToReview(
    userId: string,
    mediaItemId: string,
    rating: number | null,
  ): Promise<void> {
    // Skip sync when rating is cleared — reviews always require a numeric rating
    if (rating === null) {
      return;
    }

    const review = await this.reviewRepo.findByUserAndMedia(userId, mediaItemId);

    if (!review || review.rating === rating) {
      return;
    }

    // IMPORTANT: Call repo.update directly, NOT this.update(), to avoid
    // re-triggering trySyncRating → syncRating → setState → emit event loop.
    await this.reviewRepo.update(review.id, { rating });
    this.logger.log(
      `Synced rating ${rating} to review ${review.id} for user=${userId}, media=${mediaItemId}`,
    );
  }

  private async trySyncRating(
    userId: string,
    mediaItemId: string,
    rating: number,
    mediaType?: MediaType,
  ): Promise<void> {
    try {
      await this.ratingSync.syncRating(userId, mediaItemId, rating, mediaType);
    } catch (error) {
      this.logger.warn(
        `Failed to sync rating to user_media_state: user=${userId}, media=${mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
