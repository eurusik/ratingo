/**
 * Typed reviews API client.
 *
 * Provides type-safe methods for reviews endpoints.
 */

import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// Types from api-contract
// ============================================================================

export type ReviewResponseDto = components['schemas']['ReviewResponseDto'];
export type ReviewListResponseDto = components['schemas']['ReviewListResponseDto'];
export type ReviewMutationResponseDto = components['schemas']['ReviewMutationResponseDto'];
export type ReviewAuthorDto = components['schemas']['ReviewAuthorDto'];
export type VoteResultDto = components['schemas']['VoteResultDto'];

export type ReviewSort = 'newest' | 'oldest' | 'most_liked';

export const VOTE_TYPE = {
  LIKE: 'like',
  DISLIKE: 'dislike',
} as const;

export type VoteType = (typeof VOTE_TYPE)[keyof typeof VOTE_TYPE];

export interface ListReviewsParams {
  mediaItemId: string;
  sort?: ReviewSort;
  limit?: number;
  offset?: number;
  hideSpoilers?: boolean;
}

export interface CreateReviewParams {
  mediaItemId: string;
  content: string;
  rating: number;
  hasSpoiler?: boolean;
}

export interface UpdateReviewParams {
  reviewId: string;
  content?: string;
  rating?: number;
  hasSpoiler?: boolean;
}

export interface VoteParams {
  reviewId: string;
  voteType: VoteType;
}

// ============================================================================
// API Client
// ============================================================================

export const reviewsApi = {
  // --------------------------------------------------------------------------
  // Public endpoints
  // --------------------------------------------------------------------------

  /**
   * List reviews for a media item.
   *
   * @param params - Query parameters
   * @returns Paginated list of reviews
   */
  async listForMedia(params: ListReviewsParams): Promise<ReviewListResponseDto> {
    const { mediaItemId, ...searchParams } = params;
    return apiGet<ReviewListResponseDto>(`reviews/media/${mediaItemId}`, {
      searchParams: searchParams as Record<string, string | number | boolean>,
    });
  },

  /**
   * Get a single review by ID.
   *
   * @param reviewId - Review UUID
   * @returns Review with author info
   */
  async getById(reviewId: string): Promise<ReviewResponseDto> {
    return apiGet<ReviewResponseDto>(`reviews/${reviewId}`);
  },

  // --------------------------------------------------------------------------
  // Authenticated endpoints
  // --------------------------------------------------------------------------

  /**
   * Create a new review.
   *
   * @param params - Review data
   * @returns Created review
   */
  async create(params: CreateReviewParams): Promise<ReviewMutationResponseDto> {
    return apiPost<ReviewMutationResponseDto>('me/reviews', params);
  },

  /**
   * Get the current user's review for a media item.
   *
   * @param mediaItemId - Media item UUID
   * @returns User's review or null
   */
  async getMyReviewForMedia(mediaItemId: string): Promise<ReviewMutationResponseDto | null> {
    return apiGet<ReviewMutationResponseDto | null>(`me/reviews/media/${mediaItemId}`);
  },

  /**
   * Update a review.
   *
   * @param params - Update data
   * @returns Updated review
   */
  async update(params: UpdateReviewParams): Promise<ReviewMutationResponseDto> {
    const { reviewId, ...body } = params;
    return apiPatch<ReviewMutationResponseDto>(`me/reviews/${reviewId}`, body);
  },

  /**
   * Delete a review.
   *
   * @param reviewId - Review UUID
   */
  async delete(reviewId: string): Promise<void> {
    await apiDelete<void>(`me/reviews/${reviewId}`);
  },

  /**
   * Vote on a review (like or dislike).
   *
   * @param params - Vote data
   * @returns Vote result
   */
  async vote(params: VoteParams): Promise<VoteResultDto> {
    const { reviewId, voteType } = params;
    return apiPost<VoteResultDto>(`me/reviews/${reviewId}/vote`, { voteType });
  },

  /**
   * Remove vote from a review.
   *
   * @param reviewId - Review UUID
   * @returns Vote result
   */
  async unvote(reviewId: string): Promise<VoteResultDto> {
    return apiDelete<VoteResultDto>(`me/reviews/${reviewId}/vote`);
  },
};
