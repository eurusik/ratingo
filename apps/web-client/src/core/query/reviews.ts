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
 * Invalidates all caches affected by review mutations.
 * Covers: review lists, user's own review, and standalone rating state.
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

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateReviewParams) => reviewsApi.create(params),
    onSuccess: (_data, variables) => {
      invalidateReviewCaches(queryClient, variables.mediaItemId);
    },
  });
}

export function useUpdateReview(mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdateReviewParams) => reviewsApi.update(params),
    onSuccess: () => {
      invalidateReviewCaches(queryClient, mediaItemId);
    },
  });
}

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

export function useDeleteReply(reviewId: string, mediaItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (replyId: string) => reviewsApi.deleteReply(replyId),
    onSuccess: () => {
      invalidateReplyCaches(queryClient, reviewId, mediaItemId);
    },
  });
}

export function useReportReview() {
  return useMutation({
    mutationFn: (params: { reviewId: string; reason: ReportReason; details?: string }) =>
      reviewsApi.reportReview(params),
  });
}
