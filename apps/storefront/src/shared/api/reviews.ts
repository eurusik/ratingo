import type { components } from '@ratingo/api-contract';
import { apiDelete, apiGet, apiPatch, apiPost } from '@ratingo/web-core/api';
import type { MediaType } from './catalog';
import { cacheOptions, type CatalogCache } from './request-cache';

export type Review = components['schemas']['ReviewResponseDto'];
export type ReviewReply = components['schemas']['ReplyResponseDto'];
type ReviewList = components['schemas']['ReviewListResponseDto'];
type ReviewMutation = components['schemas']['ReviewMutationResponseDto'];
type CreateReview = components['schemas']['CreateReviewDto'];
type UpdateReview = components['schemas']['UpdateReviewDto'];
type ReviewVote = components['schemas']['ReviewVoteDto'];
type VoteResult = components['schemas']['VoteResultDto'];
type CreateReply = components['schemas']['CreateReplyDto'];
type CreateReport = components['schemas']['CreateReportDto'];
type ReplyMutation = components['schemas']['ReplyMutationResponseDto'];
type ReportResult = components['schemas']['ReportResponseDto'];

export type ReviewSort = 'most_liked' | 'newest' | 'oldest';
export type VoteType = ReviewVote['voteType'];
export type ReportReason = CreateReport['reason'];

export interface ReviewPage {
  reviews: Review[];
  total: number;
}

interface ReviewMeta {
  total?: number;
}

export interface ReviewDraft {
  content: string;
  rating: number;
  hasSpoiler: boolean;
}

export interface ReplyDraft {
  content: string;
  parentReplyId?: string;
  replyToUsername?: string;
}

interface ReviewPageQuery {
  sort: ReviewSort;
  limit: number;
  offset: number;
}

export const reviewsApi = {
  async listForMedia(
    mediaItemId: string,
    query: ReviewPageQuery,
    cache?: CatalogCache,
  ): Promise<ReviewPage> {
    const list = await apiGet<ReviewList>(`reviews/media/${mediaItemId}`, {
      searchParams: { ...query },
      ...cacheOptions(cache),
    });
    const meta = list.meta as ReviewMeta;
    return { reviews: list.data, total: meta.total ?? list.data.length };
  },

  getById(reviewId: string): Promise<Review> {
    return apiGet<Review>(`reviews/${reviewId}`);
  },

  async getMine(mediaItemId: string): Promise<Review | null> {
    const mine = await apiGet<ReviewMutation | null>(`me/reviews/media/${mediaItemId}`);
    return mine ? reviewsApi.getById(mine.id) : null;
  },

  create(mediaItemId: string, mediaType: MediaType, draft: ReviewDraft): Promise<ReviewMutation> {
    return apiPost<ReviewMutation>('me/reviews', {
      mediaItemId,
      mediaType,
      ...draft,
    } satisfies CreateReview);
  },

  update(reviewId: string, draft: ReviewDraft): Promise<ReviewMutation> {
    return apiPatch<ReviewMutation>(`me/reviews/${reviewId}`, draft satisfies UpdateReview);
  },

  delete(reviewId: string): Promise<void> {
    return apiDelete(`me/reviews/${reviewId}`);
  },

  vote(reviewId: string, voteType: VoteType): Promise<VoteResult> {
    return apiPost<VoteResult>(`me/reviews/${reviewId}/vote`, { voteType } satisfies ReviewVote);
  },

  unvote(reviewId: string): Promise<VoteResult> {
    return apiDelete<VoteResult>(`me/reviews/${reviewId}/vote`);
  },

  listReplies(reviewId: string): Promise<ReviewReply[]> {
    return apiGet<ReviewReply[]>(`reviews/${reviewId}/replies`);
  },

  createReply(reviewId: string, draft: ReplyDraft): Promise<ReplyMutation> {
    return apiPost<ReplyMutation>(`me/reviews/${reviewId}/replies`, draft satisfies CreateReply);
  },

  report(reviewId: string, reason: ReportReason, details?: string): Promise<ReportResult> {
    return apiPost<ReportResult>(`me/reviews/${reviewId}/report`, {
      reason,
      details,
    } satisfies CreateReport);
  },
} as const;
