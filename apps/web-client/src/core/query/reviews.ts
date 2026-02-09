import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import {
  reviewsApi,
  VOTE_TYPE,
  type ReviewListResponseDto,
  type ReviewResponseDto,
  type ReviewMutationResponseDto,
  type ReplyResponseDto,
  type ReviewSort,
  type VoteType,
  type CreateReviewParams,
  type UpdateReviewParams,
  type CreateReplyParams,
  type ReportReason,
} from '../api/reviews.client';
import { queryKeys } from './keys';
import { retryUnlessUnauthorized } from './utils';

/**
 * Invalidate review-related query caches for a given media item.
 *
 * Invalidates the media base reviews list, the current user's review for the media item,
 * and the user's standalone media state (e.g., rating).
 *
 * @param mediaItemId - The ID of the media item whose review caches should be invalidated
 */
function invalidateReviewCaches(queryClient: QueryClient, mediaItemId: string) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.reviews.mediaBase(mediaItemId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.reviews.myReview(mediaItemId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.userMedia.state(mediaItemId),
  });
}

/**
 * Invalidate cached queries for a review's replies and the media item's base reviews.
 *
 * @param reviewId - The ID of the review whose replies cache should be invalidated
 * @param mediaItemId - The ID of the media item whose base reviews cache should be invalidated
 */
function invalidateReplyCaches(
  queryClient: QueryClient,
  reviewId: string,
  mediaItemId: string,
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.reviews.replies(reviewId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.reviews.mediaBase(mediaItemId),
  });
}

type ReviewUpdater = (review: ReviewResponseDto) => ReviewResponseDto;

/**
 * Create an updater function that applies a specified vote to a review.
 *
 * @param voteType - The vote to apply (`VOTE_TYPE.LIKE` or `VOTE_TYPE.DISLIKE`).
 * @returns A function that takes a review and returns a new review with `currentUserVote` set to `voteType` and `likesCount`/`dislikesCount` adjusted to reflect the applied vote.
 */
function applyVote(voteType: VoteType): ReviewUpdater {
  return (review) => {
    const wasLiked = review.currentUserVote === VOTE_TYPE.LIKE;
    const wasDisliked = review.currentUserVote === VOTE_TYPE.DISLIKE;
    const isLiking = voteType === VOTE_TYPE.LIKE;

    return {
      ...review,
      currentUserVote: voteType,
      likesCount: isLiking
        ? review.likesCount + (wasLiked ? 0 : 1)
        : review.likesCount - (wasLiked ? 1 : 0),
      dislikesCount: !isLiking
        ? review.dislikesCount + (wasDisliked ? 0 : 1)
        : review.dislikesCount - (wasDisliked ? 1 : 0),
    };
  };
}

/**
 * Create an updated review object with the current user's vote cleared and vote counts adjusted.
 *
 * @param review - The review object to update
 * @returns A new `ReviewResponseDto` with `currentUserVote` set to `null`; `likesCount` is decremented by 1 if the previous vote was a like, `dislikesCount` is decremented by 1 if the previous vote was a dislike
 */
function removeVote(review: ReviewResponseDto): ReviewResponseDto {
  const wasLiked = review.currentUserVote === VOTE_TYPE.LIKE;
  const wasDisliked = review.currentUserVote === VOTE_TYPE.DISLIKE;

  return {
    ...review,
    currentUserVote: null,
    likesCount: wasLiked ? review.likesCount - 1 : review.likesCount,
    dislikesCount: wasDisliked ? review.dislikesCount - 1 : review.dislikesCount,
  };
}

type PreviousQueries = [unknown, ReviewListResponseDto | undefined][];

/**
 * Creates React Query mutation handlers for performing optimistic vote updates on a media item's reviews list.
 *
 * @param mediaItemId - ID of the media item whose reviews list will be updated optimistically
 * @param createUpdater - Given mutation variables, returns a function that transforms a review into its optimistic updated state
 * @param getReviewId - Given mutation variables, returns the ID of the review to update
 * @returns An object with `onMutate`, `onError`, and `onSettled` handlers for a mutation: `onMutate` applies the optimistic update and returns a rollback context, `onError` restores cached queries from that context, and `onSettled` invalidates the reviews list cache
 */
function createOptimisticVoteHandlers<TVariables>(
  queryClient: QueryClient,
  mediaItemId: string,
  createUpdater: (variables: TVariables) => ReviewUpdater,
  getReviewId: (variables: TVariables) => string,
) {
  const baseKey = queryKeys.reviews.mediaBase(mediaItemId);

  return {
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: baseKey });

      const previousQueries = queryClient.getQueriesData<ReviewListResponseDto>({
        queryKey: baseKey,
      });

      const updater = createUpdater(variables);
      const reviewId = getReviewId(variables);

      queryClient.setQueriesData<ReviewListResponseDto>(
        { queryKey: baseKey },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((review) =>
              review.id === reviewId ? updater(review) : review,
            ),
          };
        },
      );

      return { previousQueries };
    },

    onError: (
      _error: unknown,
      _variables: TVariables,
      context?: { previousQueries?: PreviousQueries },
    ) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        if (data) queryClient.setQueryData(queryKey as readonly unknown[], data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseKey });
    },
  };
}

interface ReviewsQueryParams {
  mediaItemId: string;
  sort?: ReviewSort;
  limit?: number;
  offset?: number;
  hideSpoilers?: boolean;
}

/**
 * Fetches a paginated list of reviews for a given media item.
 *
 * @param options - Parameters to identify and filter the reviews: `mediaItemId` (media identifier), optional `sort`, `limit`, `offset`, and `hideSpoilers`.
 * @param queryOptions - Additional react-query options to customize caching and behavior for the reviews query.
 * @returns The query result containing the list of reviews for the specified media and the current query status. 
 */
export function useReviews(
  options: ReviewsQueryParams,
  queryOptions?: Omit<UseQueryOptions<ReviewListResponseDto>, 'queryKey' | 'queryFn'>,
) {
  const { mediaItemId, sort, limit, offset, hideSpoilers } = options;

  return useQuery({
    queryKey: queryKeys.reviews.forMedia(mediaItemId, sort, limit, offset),
    queryFn: () =>
      reviewsApi.listForMedia({ mediaItemId, sort, limit, offset, hideSpoilers }),
    staleTime: 1000 * 60 * 2,
    ...queryOptions,
  });
}

/**
 * Fetches a single review by its identifier and exposes the React Query result.
 *
 * @param reviewId - The ID of the review to fetch.
 * @param options - Optional React Query options to customize the query; `queryKey` and `queryFn` are set internally and should not be provided.
 * @returns The React Query result containing the fetched `ReviewResponseDto`, loading/error state, and helper fields.
 */
export function useReview(
  reviewId: string,
  options?: Omit<UseQueryOptions<ReviewResponseDto>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.reviews.detail(reviewId),
    queryFn: () => reviewsApi.getById(reviewId),
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

/**
 * Fetches the current user's review for a given media item.
 *
 * @param mediaItemId - ID of the media item to query the user's review for
 * @param options - Additional React Query options to customize caching and behavior (excluding `queryKey` and `queryFn`)
 * @returns The current user's review for the media item, or `null` if the user has not created a review
 */
export function useMyReview(
  mediaItemId: string,
  options?: Omit<UseQueryOptions<ReviewMutationResponseDto | null>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.reviews.myReview(mediaItemId),
    queryFn: () => reviewsApi.getMyReviewForMedia(mediaItemId),
    staleTime: 1000 * 60 * 5,
    retry: retryUnlessUnauthorized,
    ...options,
  });
}

/**
 * Create a new review for a media item and invalidate related review caches when the creation succeeds.
 *
 * @returns A React Query mutation that accepts `CreateReviewParams` to create a review; on success it invalidates review-related caches for the affected `mediaItemId`.
 */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateReviewParams) => reviewsApi.create(params),
    onSuccess: (_data, variables) => {
      invalidateReviewCaches(queryClient, variables.mediaItemId);
    },
  });
}

/**
 * Creates a mutation hook for updating a review for a specific media item.
 *
 * @param mediaItemId - The media item's identifier used to scope cache invalidation after a successful update
 * @returns A mutation object that performs the review update and invalidates review-related caches for the given media item on success
 */
export function useUpdateReview(mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateReviewParams) => reviewsApi.update(params),
    onSuccess: () => {
      invalidateReviewCaches(queryClient, mediaItemId);
    },
  });
}

/**
 * Creates a mutation hook for deleting a review associated with a specific media item.
 *
 * @param mediaItemId - The media item ID whose review-related caches will be invalidated after deletion
 * @returns A mutation configured to delete a review by its ID; on success it invalidates review and related caches for the given media item
 */
export function useDeleteReview(mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: string) => reviewsApi.delete(reviewId),
    onSuccess: () => {
      invalidateReviewCaches(queryClient, mediaItemId);
    },
  });
}

interface VoteVariables {
  reviewId: string;
  voteType: VoteType;
}

/**
 * Hook that returns a mutation for casting a vote on a review with optimistic cache updates scoped to the given media item.
 *
 * @returns A mutation object that executes the vote operation for a review and applies optimistic updates to related review caches (updates like/dislike counts and the current user's vote).
 */
export function useVoteReview(mediaItemId: string) {
  const queryClient = useQueryClient();

  const handlers = createOptimisticVoteHandlers<VoteVariables>(
    queryClient,
    mediaItemId,
    (variables) => applyVote(variables.voteType),
    (variables) => variables.reviewId,
  );

  return useMutation({
    mutationFn: (variables: VoteVariables) =>
      reviewsApi.vote({ reviewId: variables.reviewId, voteType: variables.voteType }),
    ...handlers,
  });
}

/**
 * Create a mutation hook that removes the current user's vote from a review and applies optimistic updates to the related review caches for the specified media item.
 *
 * @param mediaItemId - Media item ID whose associated review caches (media base reviews, my review, etc.) will be updated/invalidated during the unvote lifecycle
 * @returns A mutation object that accepts a review ID (`string`) and unvotes that review; applies optimistic cache updates and restores or invalidates caches on error/settle
 */
export function useUnvoteReview(mediaItemId: string) {
  const queryClient = useQueryClient();

  const handlers = createOptimisticVoteHandlers<string>(
    queryClient,
    mediaItemId,
    () => removeVote,
    (variables) => variables,
  );

  return useMutation({
    mutationFn: (reviewId: string) => reviewsApi.unvote(reviewId),
    ...handlers,
  });
}

/**
 * Fetches the list of replies for a specific review.
 *
 * @param reviewId - The ID of the review whose replies should be fetched
 * @param options - Optional React Query options to customize caching/behavior for this query
 * @returns The array of reply objects for the given review
 */
export function useReplies(
  reviewId: string,
  options?: Omit<UseQueryOptions<ReplyResponseDto[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: queryKeys.reviews.replies(reviewId),
    queryFn: () => reviewsApi.listReplies(reviewId),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

/**
 * Creates a reply to a review and invalidates reply-related caches on success.
 *
 * @param reviewId - ID of the review to which the reply will be posted
 * @param mediaItemId - ID of the media item associated with the review; used to determine which media review caches to invalidate
 * @returns A mutation object that accepts reply parameters (excluding `reviewId`) to create the reply; on success it refreshes reply lists and affected media review caches
 */
export function useCreateReply(reviewId: string, mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Omit<CreateReplyParams, 'reviewId'>) =>
      reviewsApi.createReply({ ...params, reviewId }),
    onSuccess: () => {
      invalidateReplyCaches(queryClient, reviewId, mediaItemId);
    },
  });
}

/**
 * Provides a mutation hook to delete a reply and invalidate caches for that review and its media item.
 *
 * @param reviewId - The ID of the review that owns the reply being deleted
 * @param mediaItemId - The ID of the media item to invalidate related review caches for
 * @returns The React Query mutation object for deleting a reply (use `mutate`/`mutateAsync` to perform deletion)
 */
export function useDeleteReply(reviewId: string, mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (replyId: string) => reviewsApi.deleteReply(replyId),
    onSuccess: () => {
      invalidateReplyCaches(queryClient, reviewId, mediaItemId);
    },
  });
}

/**
 * Creates a mutation hook to report a review with a specified reason and optional details.
 *
 * @returns A React Query mutation object; call `mutate` or `mutateAsync` with `{ reviewId, reason, details? }` to submit the report. 
 */
export function useReportReview() {
  return useMutation({
    mutationFn: (params: { reviewId: string; reason: ReportReason; details?: string }) =>
      reviewsApi.reportReview(params),
  });
}