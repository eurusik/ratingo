import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/shared/i18n/context';

jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

jest.mock('@/core/api/reviews.client', () => ({
  VOTE_TYPE: { LIKE: 'like', DISLIKE: 'dislike' },
  REVIEWS_DEFAULTS: { SORT: 'newest', LIMIT: 10 },
  reviewsApi: {
    listForMedia: jest.fn(),
    getMyReviewForMedia: jest.fn(),
  },
}));

jest.mock('@/core/auth', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
  useAuthModalStore: () => ({ openLogin: jest.fn() }),
}));

jest.mock('@/modules/saved/hooks/use-me-lists', () => ({
  useUserMediaState: () => ({ data: undefined }),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock('../review-card', () => ({
  ReviewCard: ({ review }: { review: { content: string } }) => <div>{review.content}</div>,
}));

jest.mock('../review-form', () => ({
  ReviewForm: () => null,
}));

jest.mock('../review-report-dialog', () => ({
  ReviewReportDialog: () => null,
}));

import { ReviewsSection } from '../reviews-section';
import { reviewsApi, type ReviewListResponseDto } from '@/core/api/reviews.client';

const mockListForMedia = reviewsApi.listForMedia as jest.Mock;

const MEDIA_ID = 'media-item-1';

function makeList(contents: string[]): ReviewListResponseDto {
  return {
    data: contents.map((content, index) => ({
      id: `review-${index}`,
      mediaItemId: MEDIA_ID,
      content,
      rating: 80,
      hasSpoiler: false,
      likesCount: 0,
      dislikesCount: 0,
      repliesCount: 0,
      currentUserVote: null,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
      author: { id: `author-${index}`, username: `user${index}`, avatarUrl: null },
    })),
    meta: { total: contents.length, limit: 10, offset: 0 },
  } as unknown as ReviewListResponseDto;
}

function renderSection(initialData: ReviewListResponseDto) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60 * 1000 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">
        <ReviewsSection mediaItemId={MEDIA_ID} initialData={initialData} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('ReviewsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows server-rendered reviews immediately and then replaces them with fresh ones', async () => {
    mockListForMedia.mockResolvedValue(makeList(['Fresh review', 'Cached review']));

    renderSection(makeList(['Cached review']));

    expect(screen.getByText('Cached review')).toBeInTheDocument();
    expect(screen.queryByText('Fresh review')).not.toBeInTheDocument();

    expect(await screen.findByText('Fresh review')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockListForMedia).toHaveBeenCalledTimes(1);
    });
    expect(mockListForMedia).toHaveBeenCalledWith(
      expect.objectContaining({ mediaItemId: MEDIA_ID, sort: 'newest', limit: 10 }),
    );
  });
});
