import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ky is ESM-only — must mock before any module that transitively imports it.
jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

jest.mock('@/core/api/reviews.client', () => ({
  VOTE_TYPE: { LIKE: 'like', DISLIKE: 'dislike' },
  reviewsApi: {
    listForMedia: jest.fn(),
    getById: jest.fn(),
    getMyReviewForMedia: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    vote: jest.fn(),
    unvote: jest.fn(),
    listReplies: jest.fn(),
    createReply: jest.fn(),
    deleteReply: jest.fn(),
    reportReview: jest.fn(),
  },
}));

import {
  useReviews,
  useReview,
  useMyReview,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
  useVoteReview,
  useUnvoteReview,
  useReplies,
  useCreateReply,
  useDeleteReply,
  useReportReview,
} from '../reviews';
import { queryKeys } from '../keys';
import { reviewsApi } from '@/core/api/reviews.client';
import type {
  ReviewResponseDto,
  ReviewListResponseDto,
  ReviewMutationResponseDto,
  ReplyResponseDto,
} from '@/core/api/reviews.client';

const mockListForMedia = reviewsApi.listForMedia as jest.Mock;
const mockGetById = reviewsApi.getById as jest.Mock;
const mockGetMyReviewForMedia = reviewsApi.getMyReviewForMedia as jest.Mock;
const mockCreate = reviewsApi.create as jest.Mock;
const mockUpdate = reviewsApi.update as jest.Mock;
const mockDelete = reviewsApi.delete as jest.Mock;
const mockVote = reviewsApi.vote as jest.Mock;
const mockUnvote = reviewsApi.unvote as jest.Mock;
const mockListReplies = reviewsApi.listReplies as jest.Mock;
const mockCreateReply = reviewsApi.createReply as jest.Mock;
const mockDeleteReply = reviewsApi.deleteReply as jest.Mock;
const mockReportReview = reviewsApi.reportReview as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithClient(ui: React.ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const MEDIA_ID = 'media-item-1';
const REVIEW_ID = 'review-1';
const REPLY_ID = 'reply-1';

function makeReview(overrides?: Partial<ReviewResponseDto>): ReviewResponseDto {
  return {
    id: REVIEW_ID,
    mediaItemId: MEDIA_ID,
    content: 'Great movie!',
    rating: 85,
    hasSpoiler: false,
    likesCount: 10,
    dislikesCount: 2,
    repliesCount: 0,
    currentUserVote: null,
    createdAt: '2024-01-15T10:30:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z',
    author: {
      id: 'author-1',
      username: 'testuser',
      avatarUrl: null,
    },
    ...overrides,
  } as ReviewResponseDto;
}

function makeReviewListResponse(
  reviews: ReviewResponseDto[],
): ReviewListResponseDto {
  return {
    data: reviews,
    meta: { total: reviews.length, limit: 10, offset: 0 },
  } as ReviewListResponseDto;
}

function makeReply(overrides?: Partial<ReplyResponseDto>): ReplyResponseDto {
  return {
    id: REPLY_ID,
    reviewId: REVIEW_ID,
    content: 'Nice review!',
    createdAt: '2024-01-16T10:30:00.000Z',
    updatedAt: '2024-01-16T10:30:00.000Z',
    author: {
      id: 'author-2',
      username: 'replier',
      avatarUrl: null,
    },
    ...overrides,
  } as ReplyResponseDto;
}

// ---------------------------------------------------------------------------
// Consumer components
// ---------------------------------------------------------------------------

function ReviewsConsumer({ sort, limit, offset, hideSpoilers }: {
  sort?: string;
  limit?: number;
  offset?: number;
  hideSpoilers?: boolean;
}) {
  const query = useReviews(
    { mediaItemId: MEDIA_ID, sort: sort as any, limit, offset, hideSpoilers },
  );

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function SingleReviewConsumer({ reviewId }: { reviewId: string }) {
  const query = useReview(reviewId);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function MyReviewConsumer() {
  const query = useMyReview(MEDIA_ID);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function CreateReviewConsumer() {
  const mutation = useCreateReview();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="create"
        onClick={() =>
          mutation.mutate({
            mediaItemId: MEDIA_ID,
            content: 'My review',
            rating: 90,
          })
        }
      />
    </div>
  );
}

function UpdateReviewConsumer() {
  const mutation = useUpdateReview(MEDIA_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="update"
        onClick={() =>
          mutation.mutate({ reviewId: REVIEW_ID, content: 'Updated review' })
        }
      />
    </div>
  );
}

function DeleteReviewConsumer() {
  const mutation = useDeleteReview(MEDIA_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="delete"
        onClick={() => mutation.mutate(REVIEW_ID)}
      />
    </div>
  );
}

function VoteReviewConsumer() {
  const query = useReviews({ mediaItemId: MEDIA_ID });
  const mutation = useVoteReview(MEDIA_ID);
  const firstReview = query.data?.data?.[0];

  return (
    <div>
      <span data-testid="query-status">{query.status}</span>
      <span data-testid="likes-count">{String(firstReview?.likesCount ?? 'none')}</span>
      <span data-testid="dislikes-count">{String(firstReview?.dislikesCount ?? 'none')}</span>
      <span data-testid="current-vote">{String(firstReview?.currentUserVote ?? 'none')}</span>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="upvote"
        onClick={() =>
          mutation.mutate({ reviewId: REVIEW_ID, voteType: 'like' })
        }
      />
      <button
        data-testid="downvote"
        onClick={() =>
          mutation.mutate({ reviewId: REVIEW_ID, voteType: 'dislike' })
        }
      />
    </div>
  );
}

function UnvoteReviewConsumer() {
  const query = useReviews({ mediaItemId: MEDIA_ID });
  const mutation = useUnvoteReview(MEDIA_ID);
  const firstReview = query.data?.data?.[0];

  return (
    <div>
      <span data-testid="query-status">{query.status}</span>
      <span data-testid="likes-count">{String(firstReview?.likesCount ?? 'none')}</span>
      <span data-testid="dislikes-count">{String(firstReview?.dislikesCount ?? 'none')}</span>
      <span data-testid="current-vote">{String(firstReview?.currentUserVote ?? 'none')}</span>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="unvote"
        onClick={() => mutation.mutate(REVIEW_ID)}
      />
    </div>
  );
}

function RepliesConsumer() {
  const query = useReplies(REVIEW_ID);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function CreateReplyConsumer() {
  const mutation = useCreateReply(REVIEW_ID, MEDIA_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="create-reply"
        onClick={() => mutation.mutate({ content: 'My reply' })}
      />
    </div>
  );
}

function DeleteReplyConsumer() {
  const mutation = useDeleteReply(REVIEW_ID, MEDIA_ID);

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="delete-reply"
        onClick={() => mutation.mutate(REPLY_ID)}
      />
    </div>
  );
}

function ReportReviewConsumer() {
  const mutation = useReportReview();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="report"
        onClick={() =>
          mutation.mutate({
            reviewId: REVIEW_ID,
            reason: 'spam' as any,
            details: 'Spam content',
          })
        }
      />
    </div>
  );
}

// ===========================================================================
// Query hooks
// ===========================================================================

describe('useReviews', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches reviews for a media item', async () => {
    const reviews = makeReviewListResponse([makeReview()]);
    mockListForMedia.mockResolvedValue(reviews);

    renderWithClient(<ReviewsConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockListForMedia).toHaveBeenCalledWith({
      mediaItemId: MEDIA_ID,
      sort: undefined,
      limit: undefined,
      offset: undefined,
      hideSpoilers: undefined,
    });
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(reviews));
  });

  it('passes sort, limit, offset, and hideSpoilers to API', async () => {
    mockListForMedia.mockResolvedValue(makeReviewListResponse([]));

    renderWithClient(
      <ReviewsConsumer sort="most_liked" limit={5} offset={10} hideSpoilers />,
      queryClient,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockListForMedia).toHaveBeenCalledWith({
      mediaItemId: MEDIA_ID,
      sort: 'most_liked',
      limit: 5,
      offset: 10,
      hideSpoilers: true,
    });
  });
});

describe('useReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches a single review by ID', async () => {
    const review = makeReview();
    mockGetById.mockResolvedValue(review);

    renderWithClient(<SingleReviewConsumer reviewId={REVIEW_ID} />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetById).toHaveBeenCalledWith(REVIEW_ID);
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(review));
  });
});

describe('useMyReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches the current user review for media', async () => {
    const myReview = { id: REVIEW_ID, content: 'My review' } as ReviewMutationResponseDto;
    mockGetMyReviewForMedia.mockResolvedValue(myReview);

    renderWithClient(<MyReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockGetMyReviewForMedia).toHaveBeenCalledWith(MEDIA_ID);
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(myReview));
  });

  it('handles null when user has no review', async () => {
    mockGetMyReviewForMedia.mockResolvedValue(null);

    renderWithClient(<MyReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(screen.getByTestId('data').textContent).toBe('null');
  });
});

// ===========================================================================
// Review CRUD mutations
// ===========================================================================

describe('useCreateReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls reviewsApi.create and invalidates review caches on success', async () => {
    const created = { id: 'new-review', content: 'My review' } as ReviewMutationResponseDto;
    mockCreate.mockResolvedValue(created);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<CreateReviewConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('create').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockCreate).toHaveBeenCalledWith({
      mediaItemId: MEDIA_ID,
      content: 'My review',
      rating: 90,
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.myReview(MEDIA_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.userMedia.state(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not invalidate caches on error', async () => {
    mockCreate.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<CreateReviewConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('create').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });
});

describe('useUpdateReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls reviewsApi.update and invalidates review caches on success', async () => {
    const updated = { id: REVIEW_ID, content: 'Updated review' } as ReviewMutationResponseDto;
    mockUpdate.mockResolvedValue(updated);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<UpdateReviewConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('update').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      reviewId: REVIEW_ID,
      content: 'Updated review',
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.myReview(MEDIA_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.userMedia.state(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });
});

describe('useDeleteReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls reviewsApi.delete and invalidates review caches on success', async () => {
    mockDelete.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<DeleteReviewConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('delete').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockDelete).toHaveBeenCalledWith(REVIEW_ID);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.myReview(MEDIA_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.userMedia.state(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });
});

// ===========================================================================
// Vote mutations with optimistic updates
// ===========================================================================

describe('useVoteReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('optimistically increments likesCount when upvoting a non-voted review', async () => {
    const review = makeReview({ likesCount: 10, dislikesCount: 2, currentUserVote: null });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockVote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
    });

    await act(async () => {
      screen.getByTestId('upvote').click();
    });

    // Optimistic update should show incremented likes
    await waitFor(() => {
      expect(screen.getByTestId('likes-count').textContent).toBe('11');
      expect(screen.getByTestId('current-vote').textContent).toBe('like');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('2');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 11, dislikesCount: 2 });
    });
  });

  it('optimistically increments dislikesCount when downvoting a non-voted review', async () => {
    const review = makeReview({ likesCount: 10, dislikesCount: 2, currentUserVote: null });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockVote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('2');
    });

    await act(async () => {
      screen.getByTestId('downvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dislikes-count').textContent).toBe('3');
      expect(screen.getByTestId('current-vote').textContent).toBe('dislike');
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 10, dislikesCount: 3 });
    });
  });

  it('swaps from dislike to like: likesCount +1, dislikesCount -1', async () => {
    const review = makeReview({
      likesCount: 10,
      dislikesCount: 5,
      currentUserVote: 'dislike' as any,
    });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockVote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('current-vote').textContent).toBe('dislike');
    });

    await act(async () => {
      screen.getByTestId('upvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('likes-count').textContent).toBe('11');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('4');
      expect(screen.getByTestId('current-vote').textContent).toBe('like');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 11, dislikesCount: 4 });
    });
  });

  it('swaps from like to dislike: dislikesCount +1, likesCount -1', async () => {
    const review = makeReview({
      likesCount: 10,
      dislikesCount: 5,
      currentUserVote: 'like' as any,
    });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockVote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('current-vote').textContent).toBe('like');
    });

    await act(async () => {
      screen.getByTestId('downvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dislikes-count').textContent).toBe('6');
      expect(screen.getByTestId('likes-count').textContent).toBe('9');
      expect(screen.getByTestId('current-vote').textContent).toBe('dislike');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 9, dislikesCount: 6 });
    });
  });

  it('is idempotent when re-applying the same vote', async () => {
    const review = makeReview({
      likesCount: 10,
      dislikesCount: 5,
      currentUserVote: 'like' as any,
    });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockVote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('upvote').click();
    });

    // Counts should not change when re-applying the same vote
    await waitFor(() => {
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('5');
      expect(screen.getByTestId('current-vote').textContent).toBe('like');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 10, dislikesCount: 5 });
    });
  });

  it('rolls back optimistic update on error', async () => {
    const review = makeReview({ likesCount: 10, dislikesCount: 2, currentUserVote: null });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);
    mockVote.mockRejectedValue(new Error('server error'));

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
    });

    await act(async () => {
      screen.getByTestId('upvote').click();
    });

    // After error, should roll back to original values
    await waitFor(() => {
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('2');
      expect(screen.getByTestId('current-vote').textContent).toBe('none');
    });
  });

  it('calls reviewsApi.vote with correct parameters', async () => {
    const review = makeReview({ currentUserVote: null });
    mockListForMedia.mockResolvedValue(makeReviewListResponse([review]));
    mockVote.mockResolvedValue({ likesCount: 11, dislikesCount: 2 });

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('upvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockVote).toHaveBeenCalledWith({
      reviewId: REVIEW_ID,
      voteType: 'like',
    });
  });

  it('invalidates review queries on settled (success)', async () => {
    const review = makeReview({ currentUserVote: null });
    mockListForMedia.mockResolvedValue(makeReviewListResponse([review]));
    mockVote.mockResolvedValue({ likesCount: 11, dislikesCount: 2 });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('upvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('invalidates review queries on settled (error)', async () => {
    const review = makeReview({ currentUserVote: null });
    mockListForMedia.mockResolvedValue(makeReviewListResponse([review]));
    mockVote.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<VoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('upvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    // onSettled fires on both success and error
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });
});

describe('useUnvoteReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('optimistically decrements likesCount when removing a like', async () => {
    const review = makeReview({
      likesCount: 10,
      dislikesCount: 2,
      currentUserVote: 'like' as any,
    });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockUnvote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<UnvoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
      expect(screen.getByTestId('current-vote').textContent).toBe('like');
    });

    await act(async () => {
      screen.getByTestId('unvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('likes-count').textContent).toBe('9');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('2');
      expect(screen.getByTestId('current-vote').textContent).toBe('none');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 9, dislikesCount: 2 });
    });
  });

  it('optimistically decrements dislikesCount when removing a dislike', async () => {
    const review = makeReview({
      likesCount: 10,
      dislikesCount: 5,
      currentUserVote: 'dislike' as any,
    });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockUnvote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<UnvoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('5');
    });

    await act(async () => {
      screen.getByTestId('unvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dislikes-count').textContent).toBe('4');
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
      expect(screen.getByTestId('current-vote').textContent).toBe('none');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 10, dislikesCount: 4 });
    });
  });

  it('does not change counts when removing a vote from a non-voted review', async () => {
    const review = makeReview({
      likesCount: 10,
      dislikesCount: 5,
      currentUserVote: null,
    });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockUnvote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<UnvoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('unvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('5');
      expect(screen.getByTestId('current-vote').textContent).toBe('none');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 10, dislikesCount: 5 });
    });
  });

  it('rolls back optimistic update on error', async () => {
    const review = makeReview({
      likesCount: 10,
      dislikesCount: 2,
      currentUserVote: 'like' as any,
    });
    const listResponse = makeReviewListResponse([review]);
    mockListForMedia.mockResolvedValue(listResponse);
    mockUnvote.mockRejectedValue(new Error('server error'));

    renderWithClient(<UnvoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
    });

    await act(async () => {
      screen.getByTestId('unvote').click();
    });

    // After error, should roll back to original
    await waitFor(() => {
      expect(screen.getByTestId('likes-count').textContent).toBe('10');
      expect(screen.getByTestId('dislikes-count').textContent).toBe('2');
      expect(screen.getByTestId('current-vote').textContent).toBe('like');
    });
  });

  it('calls reviewsApi.unvote with review ID', async () => {
    const review = makeReview({ currentUserVote: 'like' as any });
    mockListForMedia.mockResolvedValue(makeReviewListResponse([review]));
    mockUnvote.mockResolvedValue({ likesCount: 9, dislikesCount: 2 });

    renderWithClient(<UnvoteReviewConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
    });

    await act(async () => {
      screen.getByTestId('unvote').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockUnvote).toHaveBeenCalledWith(REVIEW_ID);
  });
});

// ===========================================================================
// Reply hooks
// ===========================================================================

describe('useReplies', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches replies for a review', async () => {
    const replies = [makeReply()];
    mockListReplies.mockResolvedValue(replies);

    renderWithClient(<RepliesConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockListReplies).toHaveBeenCalledWith(REVIEW_ID);
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(replies));
  });
});

describe('useCreateReply', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls reviewsApi.createReply and invalidates reply caches on success', async () => {
    mockCreateReply.mockResolvedValue({ id: 'new-reply', content: 'My reply' });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<CreateReplyConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('create-reply').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockCreateReply).toHaveBeenCalledWith({
      reviewId: REVIEW_ID,
      content: 'My reply',
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.replies(REVIEW_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });

  it('does not invalidate caches on error', async () => {
    mockCreateReply.mockRejectedValue(new Error('server error'));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<CreateReplyConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('create-reply').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('error');
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.replies(REVIEW_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });
});

describe('useDeleteReply', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls reviewsApi.deleteReply and invalidates reply caches on success', async () => {
    mockDeleteReply.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<DeleteReplyConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('delete-reply').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockDeleteReply).toHaveBeenCalledWith(REPLY_ID);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.replies(REVIEW_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.reviews.mediaBase(MEDIA_ID),
      }),
    );

    invalidateSpy.mockRestore();
  });
});

// ===========================================================================
// Report hook
// ===========================================================================

describe('useReportReview', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls reviewsApi.reportReview with correct params', async () => {
    mockReportReview.mockResolvedValue({ id: 'report-1' });

    renderWithClient(<ReportReviewConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('report').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockReportReview).toHaveBeenCalledWith({
      reviewId: REVIEW_ID,
      reason: 'spam',
      details: 'Spam content',
    });
  });

  it('does not invalidate any caches (fire-and-forget)', async () => {
    mockReportReview.mockResolvedValue({ id: 'report-1' });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<ReportReviewConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('report').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });
});

// ===========================================================================
// Optimistic update with multiple reviews in list
// ===========================================================================

describe('optimistic updates with multiple reviews', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  function MultiReviewVoteConsumer() {
    const query = useReviews({ mediaItemId: MEDIA_ID });
    const mutation = useVoteReview(MEDIA_ID);

    return (
      <div>
        <span data-testid="query-status">{query.status}</span>
        {query.data?.data?.map((review, index) => (
          <div key={review.id}>
            <span data-testid={`likes-${index}`}>{String(review.likesCount)}</span>
            <span data-testid={`current-vote-${index}`}>{String(review.currentUserVote ?? 'none')}</span>
          </div>
        ))}
        <span data-testid="mutation-status">{mutation.status}</span>
        <button
          data-testid="upvote-first"
          onClick={() =>
            mutation.mutate({ reviewId: 'review-1', voteType: 'like' })
          }
        />
      </div>
    );
  }

  it('only updates the targeted review, leaving others untouched', async () => {
    const review1 = makeReview({ id: 'review-1', likesCount: 5, currentUserVote: null });
    const review2 = makeReview({ id: 'review-2', likesCount: 8, currentUserVote: null });
    const listResponse = makeReviewListResponse([review1, review2]);
    mockListForMedia.mockResolvedValue(listResponse);

    let resolveMutation: (value: any) => void;
    mockVote.mockImplementation(
      () => new Promise((resolve) => { resolveMutation = resolve; }),
    );

    renderWithClient(<MultiReviewVoteConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('query-status').textContent).toBe('success');
      expect(screen.getByTestId('likes-0').textContent).toBe('5');
      expect(screen.getByTestId('likes-1').textContent).toBe('8');
    });

    await act(async () => {
      screen.getByTestId('upvote-first').click();
    });

    await waitFor(() => {
      // First review: liked
      expect(screen.getByTestId('likes-0').textContent).toBe('6');
      expect(screen.getByTestId('current-vote-0').textContent).toBe('like');
      // Second review: unchanged
      expect(screen.getByTestId('likes-1').textContent).toBe('8');
      expect(screen.getByTestId('current-vote-1').textContent).toBe('none');
    });

    await act(async () => {
      resolveMutation!({ likesCount: 6, dislikesCount: 2 });
    });
  });
});
