/**
 * React Query hooks for reviews.
 * Provides optimistic updates for voting.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import {
  reviewsApi,
  VOTE_TYPE,
  type ReviewListResponseDto,
  type ReviewResponseDto,
  type ReviewMutationResponseDto,
  type ReplyResponseDto,
  type ReplyMutationResponseDto,
  type VoteResultDto,
  type ReviewSort,
  type VoteType,
  type CreateReviewParams,
  type UpdateReviewParams,
  type CreateReplyParams,
} from '../api/reviews.client';
import { queryKeys } from './keys';

/** Checks if error is a 401 Unauthorized. */
function isUnauthorized(error: unknown): boolean {
  return error instanceof HTTPError && error.response.status === 401;
}

// ============================================================================
// Query Hooks
// ============================================================================

interface UseReviewsOptions {
  mediaItemId: string;
  sort?: ReviewSort;
  limit?: number;
  offset?: number;
  hideSpoilers?: boolean;
}

/**
 * Fetches reviews for a media item.
 *
 * @param options - Query options
 * @param queryOptions - Additional TanStack Query options
 * @returns Query result with reviews list
 */
export function useReviews(
  options: UseReviewsOptions,
  queryOptions?: Omit<UseQueryOptions<ReviewListResponseDto>, 'queryKey' | 'queryFn'>,
) {
  const { mediaItemId, sort, limit, offset, hideSpoilers } = options;

  return useQuery({
    queryKey: queryKeys.reviews.forMedia(mediaItemId, sort, limit, offset),
    queryFn: () =>
      reviewsApi.listForMedia({
        mediaItemId,
        sort,
        limit,
        offset,
        hideSpoilers,
      }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    ...queryOptions,
  });
}

/**
 * Fetches a single review by ID.
 *
 * @param reviewId - Review UUID
 * @param options - Additional query options
 * @returns Query result with review
 */
export function useReview(
  reviewId: string,
  options?: Omit<UseQueryOptions<ReviewResponseDto>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.reviews.detail(reviewId),
    queryFn: () => reviewsApi.getById(reviewId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}

/**
 * Fetches the current user's review for a media item.
 *
 * @param mediaItemId - Media item UUID
 * @param options - Additional query options
 * @returns Query result with user's review or null
 */
export function useMyReview(
  mediaItemId: string,
  options?: Omit<UseQueryOptions<ReviewMutationResponseDto | null>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.reviews.myReview(mediaItemId),
    queryFn: () => reviewsApi.getMyReviewForMedia(mediaItemId),
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      if (isUnauthorized(error)) return false;
      return failureCount < 2;
    },
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Creates a new review.
 *
 * @returns Mutation with create function
 */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateReviewParams) => reviewsApi.create(params),

    onSuccess: (_data, variables) => {
      // Invalidate all reviews queries for this media (regardless of sort/limit/offset)
      const baseKey = [...queryKeys.reviews.all, 'media', variables.mediaItemId];
      queryClient.invalidateQueries({ queryKey: baseKey });

      // Invalidate my review query
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.myReview(variables.mediaItemId),
      });
    },
  });
}

/**
 * Updates an existing review.
 *
 * @param mediaItemId - Media item UUID (for cache invalidation)
 * @returns Mutation with update function
 */
export function useUpdateReview(mediaItemId: string) {
  const queryClient = useQueryClient();
  const baseKey = [...queryKeys.reviews.all, 'media', mediaItemId];

  return useMutation({
    mutationFn: (params: UpdateReviewParams) => reviewsApi.update(params),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.myReview(mediaItemId),
      });
    },
  });
}

/**
 * Deletes a review.
 *
 * @param mediaItemId - Media item UUID (for cache invalidation)
 * @returns Mutation with delete function
 */
export function useDeleteReview(mediaItemId: string) {
  const queryClient = useQueryClient();
  const baseKey = [...queryKeys.reviews.all, 'media', mediaItemId];

  return useMutation({
    mutationFn: (reviewId: string) => reviewsApi.delete(reviewId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.myReview(mediaItemId),
      });
    },
  });
}

interface VoteVariables {
  reviewId: string;
  voteType: VoteType;
}

/**
 * Votes on a review with optimistic updates.
 *
 * @param mediaItemId - Media item UUID (for cache invalidation)
 * @returns Mutation with vote function
 */
export function useVoteReview(mediaItemId: string) {
  const queryClient = useQueryClient();

  // Base key for matching all queries for this media (regardless of sort/limit/offset)
  const baseKey = [...queryKeys.reviews.all, 'media', mediaItemId];

  return useMutation({
    mutationFn: (variables: VoteVariables) =>
      reviewsApi.vote({
        reviewId: variables.reviewId,
        voteType: variables.voteType,
      }),

    onMutate: async (variables) => {
      // Cancel outgoing refetches for all queries matching this media
      await queryClient.cancelQueries({ queryKey: baseKey });

      // Snapshot all matching queries for rollback
      const previousQueries = queryClient.getQueriesData<ReviewListResponseDto>({
        queryKey: baseKey,
      });

      // Optimistic update for all matching queries
      queryClient.setQueriesData<ReviewListResponseDto>(
        { queryKey: baseKey },
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            data: oldData.data.map((review) => {
              if (review.id !== variables.reviewId) return review;

              const wasLiked = review.currentUserVote === VOTE_TYPE.LIKE;
              const wasDisliked = review.currentUserVote === VOTE_TYPE.DISLIKE;
              const isLiking = variables.voteType === VOTE_TYPE.LIKE;

              return {
                ...review,
                currentUserVote: variables.voteType,
                likesCount: isLiking
                  ? review.likesCount + (wasLiked ? 0 : 1)
                  : review.likesCount - (wasLiked ? 1 : 0),
                dislikesCount: !isLiking
                  ? review.dislikesCount + (wasDisliked ? 0 : 1)
                  : review.dislikesCount - (wasDisliked ? 1 : 0),
              };
            }),
          };
        },
      );

      return { previousQueries };
    },

    onError: (_error, _variables, context) => {
      // Rollback all queries to their previous state
      context?.previousQueries?.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData(queryKey, data);
        }
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  });
}

/**
 * Removes vote from a review with optimistic updates.
 *
 * @param mediaItemId - Media item UUID (for cache invalidation)
 * @returns Mutation with unvote function
 */
export function useUnvoteReview(mediaItemId: string) {
  const queryClient = useQueryClient();

  // Base key for matching all queries for this media (regardless of sort/limit/offset)
  const baseKey = [...queryKeys.reviews.all, 'media', mediaItemId];

  return useMutation({
    mutationFn: (reviewId: string) => reviewsApi.unvote(reviewId),

    onMutate: async (reviewId) => {
      // Cancel outgoing refetches for all queries matching this media
      await queryClient.cancelQueries({ queryKey: baseKey });

      // Snapshot all matching queries for rollback
      const previousQueries = queryClient.getQueriesData<ReviewListResponseDto>({
        queryKey: baseKey,
      });

      // Optimistic update for all matching queries
      queryClient.setQueriesData<ReviewListResponseDto>(
        { queryKey: baseKey },
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            data: oldData.data.map((review) => {
              if (review.id !== reviewId) return review;

              const wasLiked = review.currentUserVote === VOTE_TYPE.LIKE;
              const wasDisliked = review.currentUserVote === VOTE_TYPE.DISLIKE;

              return {
                ...review,
                currentUserVote: null,
                likesCount: wasLiked ? review.likesCount - 1 : review.likesCount,
                dislikesCount: wasDisliked ? review.dislikesCount - 1 : review.dislikesCount,
              };
            }),
          };
        },
      );

      return { previousQueries };
    },

    onError: (_error, _variables, context) => {
      // Rollback all queries to their previous state
      context?.previousQueries?.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData(queryKey, data);
        }
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  });
}

// ============================================================================
// Reply Hooks
// ============================================================================

/**
 * Fetches replies for a review.
 *
 * @param reviewId - Review UUID
 * @param options - Additional query options
 * @returns Query result with replies list
 */
export function useReplies(
  reviewId: string,
  options?: Omit<UseQueryOptions<ReplyResponseDto[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.reviews.replies(reviewId),
    queryFn: () => reviewsApi.listReplies(reviewId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    ...options,
  });
}

/**
 * Creates a reply to a review.
 *
 * @param reviewId - Review UUID
 * @param mediaItemId - Media item UUID (for cache invalidation)
 * @returns Mutation with create function
 */
export function useCreateReply(reviewId: string, mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Omit<CreateReplyParams, 'reviewId'>) =>
      reviewsApi.createReply({ ...params, reviewId }),

    onSuccess: () => {
      // Invalidate replies for this review
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.replies(reviewId),
      });

      // Invalidate reviews list to update repliesCount
      const baseKey = [...queryKeys.reviews.all, 'media', mediaItemId];
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  });
}

/**
 * Deletes a reply.
 *
 * @param reviewId - Review UUID (for cache invalidation)
 * @param mediaItemId - Media item UUID (for cache invalidation)
 * @returns Mutation with delete function
 */
export function useDeleteReply(reviewId: string, mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (replyId: string) => reviewsApi.deleteReply(replyId),

    onSuccess: () => {
      // Invalidate replies for this review
      queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.replies(reviewId),
      });

      // Invalidate reviews list to update repliesCount
      const baseKey = [...queryKeys.reviews.all, 'media', mediaItemId];
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  });
}

// ============================================================================
// Report Hooks
// ============================================================================

/**
 * Reports a review.
 *
 * @returns Mutation with report function
 */
export function useReportReview() {
  return useMutation({
    mutationFn: (params: { reviewId: string; reason: string; details?: string }) =>
      reviewsApi.reportReview({
        reviewId: params.reviewId,
        reason: params.reason as any,
        details: params.details,
      }),
  });
}
