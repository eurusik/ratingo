import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nProvider } from '@/shared/i18n/context';

// Mock the reviews client to avoid ESM issues
jest.mock('@/core/api/reviews.client', () => ({
  VOTE_TYPE: {
    LIKE: 'like',
    DISLIKE: 'dislike',
  },
}));

// Mock date-fns to avoid timezone issues
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
  isToday: () => false,
  isYesterday: () => false,
  differenceInDays: () => 10,
  format: () => '15 Jan 2024',
}));

jest.mock('date-fns/locale', () => ({
  uk: {},
  enUS: {},
}));

// Mock ReviewReplies to avoid testing it here
jest.mock('../review-replies', () => ({
  ReviewReplies: () => null,
}));

// Import after mocks
import { ReviewCard } from '../review-card';
import { VOTE_TYPE } from '@/core/api/reviews.client';

// Wrapper with I18nProvider for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider locale="uk">{children}</I18nProvider>
);

async function renderWithI18n(ui: React.ReactElement) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui, { wrapper: TestWrapper });
  });
  return result!;
}

const mockReview = {
  id: 'review-id-1',
  mediaItemId: 'media-id-1',
  content: 'Great movie with amazing visuals!',
  rating: 85,
  hasSpoiler: false,
  likesCount: 10,
  dislikesCount: 2,
  repliesCount: 3,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  author: {
    id: 'author-id',
    username: 'testuser',
    avatarUrl: 'https://example.com/avatar.jpg',
    showRatings: true,
    isProfilePublic: true,
  },
  currentUserVote: null,
};

const mediaItemId = 'media-id-1';

describe('ReviewCard', () => {
  describe('rendering', () => {
    it('should render review content', async () => {
      await renderWithI18n(<ReviewCard review={mockReview} mediaItemId={mediaItemId} />);

      expect(screen.getByText('Great movie with amazing visuals!')).toBeInTheDocument();
    });

    it('should render author username', async () => {
      await renderWithI18n(<ReviewCard review={mockReview} mediaItemId={mediaItemId} />);

      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('should render rating when author allows it', async () => {
      const { container } = await renderWithI18n(<ReviewCard review={mockReview} mediaItemId={mediaItemId} />);

      // Check for rating value and Star icon
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(container.querySelector('.lucide-star')).toBeInTheDocument();
    });

    it('should not render rating when rating is null', async () => {
      const reviewWithoutRating = { ...mockReview, rating: null };
      const { container } = await renderWithI18n(<ReviewCard review={reviewWithoutRating} mediaItemId={mediaItemId} />);

      // No Star icon in rating badge (only in other places if any)
      expect(container.querySelector('.fill-cinema-text-disabled')).not.toBeInTheDocument();
    });

    it('should render vote counts', async () => {
      await renderWithI18n(<ReviewCard review={mockReview} mediaItemId={mediaItemId} />);

      expect(screen.getByText('10')).toBeInTheDocument(); // likes
      expect(screen.getByText('2')).toBeInTheDocument(); // dislikes
    });

    it('should render replies count when > 0', async () => {
      await renderWithI18n(<ReviewCard review={mockReview} mediaItemId={mediaItemId} />);

      expect(screen.getByText('3')).toBeInTheDocument(); // replies
    });

    it('should not render replies count when 0', async () => {
      const reviewWithoutReplies = { ...mockReview, repliesCount: 0 };
      const { container } = await renderWithI18n(<ReviewCard review={reviewWithoutReplies} mediaItemId={mediaItemId} />);

      // MessageCircle icon should not be present - Star, ThumbsUp and ThumbsDown only
      expect(container.querySelector('.lucide-message-circle')).not.toBeInTheDocument();
      expect(container.querySelectorAll('svg')).toHaveLength(3); // Star + ThumbsUp + ThumbsDown
    });
  });

  describe('spoiler handling', () => {
    const spoilerReview = { ...mockReview, hasSpoiler: true };

    it('should blur content when hasSpoiler is true', async () => {
      const { container } = await renderWithI18n(<ReviewCard review={spoilerReview} mediaItemId={mediaItemId} />);

      const blurredElement = container.querySelector('.blur-sm');
      expect(blurredElement).toBeInTheDocument();
    });

    it('should show spoiler warning badge', async () => {
      await renderWithI18n(<ReviewCard review={spoilerReview} mediaItemId={mediaItemId} />);

      expect(screen.getByText('Спойлер')).toBeInTheDocument();
    });

    it('should show reveal link when spoiler is hidden', async () => {
      await renderWithI18n(<ReviewCard review={spoilerReview} mediaItemId={mediaItemId} />);

      expect(screen.getByText('Показати спойлер')).toBeInTheDocument();
    });

    it('should reveal content when reveal link clicked', async () => {
      const { container } = await renderWithI18n(<ReviewCard review={spoilerReview} mediaItemId={mediaItemId} />);

      const revealButton = screen.getByText('Показати спойлер');
      await act(async () => {
        fireEvent.click(revealButton);
      });

      const blurredElement = container.querySelector('.blur-sm');
      expect(blurredElement).not.toBeInTheDocument();
    });

    it('should hide reveal link after revealing', async () => {
      await renderWithI18n(<ReviewCard review={spoilerReview} mediaItemId={mediaItemId} />);

      const revealButton = screen.getByText('Показати спойлер');
      await act(async () => {
        fireEvent.click(revealButton);
      });

      expect(screen.queryByText('Показати спойлер')).not.toBeInTheDocument();
    });
  });

  describe('voting', () => {
    const mockOnVote = jest.fn();
    const mockOnUnvote = jest.fn();

    beforeEach(() => {
      mockOnVote.mockClear();
      mockOnUnvote.mockClear();
    });

    it('should call onVote with like when like button clicked', async () => {
      await renderWithI18n(
        <ReviewCard review={mockReview} mediaItemId={mediaItemId} onVote={mockOnVote} onUnvote={mockOnUnvote} />,
      );

      const likeButton = screen.getAllByRole('button')[0];
      await act(async () => {
        fireEvent.click(likeButton);
      });

      expect(mockOnVote).toHaveBeenCalledWith('review-id-1', VOTE_TYPE.LIKE);
    });

    it('should call onVote with dislike when dislike button clicked', async () => {
      await renderWithI18n(
        <ReviewCard review={mockReview} mediaItemId={mediaItemId} onVote={mockOnVote} onUnvote={mockOnUnvote} />,
      );

      const dislikeButton = screen.getAllByRole('button')[1];
      await act(async () => {
        fireEvent.click(dislikeButton);
      });

      expect(mockOnVote).toHaveBeenCalledWith('review-id-1', VOTE_TYPE.DISLIKE);
    });

    it('should call onUnvote when clicking same vote type', async () => {
      const likedReview = { ...mockReview, currentUserVote: VOTE_TYPE.LIKE };

      await renderWithI18n(
        <ReviewCard review={likedReview} mediaItemId={mediaItemId} onVote={mockOnVote} onUnvote={mockOnUnvote} />,
      );

      const likeButton = screen.getAllByRole('button')[0];
      await act(async () => {
        fireEvent.click(likeButton);
      });

      expect(mockOnUnvote).toHaveBeenCalledWith('review-id-1');
      expect(mockOnVote).not.toHaveBeenCalled();
    });

    it('should show green color when user has liked', async () => {
      const likedReview = { ...mockReview, currentUserVote: VOTE_TYPE.LIKE };
      const { container } = await renderWithI18n(<ReviewCard review={likedReview} mediaItemId={mediaItemId} />);

      const likeButton = container.querySelector('.text-green-500');
      expect(likeButton).toBeInTheDocument();
    });

    it('should show red color when user has disliked', async () => {
      const dislikedReview = { ...mockReview, currentUserVote: VOTE_TYPE.DISLIKE };
      const { container } = await renderWithI18n(<ReviewCard review={dislikedReview} mediaItemId={mediaItemId} />);

      const dislikeButton = container.querySelector('.text-red-500');
      expect(dislikeButton).toBeInTheDocument();
    });

    it('should disable vote buttons when isVoting is true', async () => {
      await renderWithI18n(<ReviewCard review={mockReview} mediaItemId={mediaItemId} isVoting={true} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });

    it('should disable vote buttons when isOwnReview is true', async () => {
      await renderWithI18n(<ReviewCard review={mockReview} mediaItemId={mediaItemId} isOwnReview={true} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });
  });

  describe('privacy', () => {
    it('should show "(приватний)" when author profile is not public', async () => {
      const privateReview = {
        ...mockReview,
        author: { ...mockReview.author, isProfilePublic: false },
      };
      await renderWithI18n(<ReviewCard review={privateReview} mediaItemId={mediaItemId} />);

      expect(screen.getByText('(приватний)')).toBeInTheDocument();
    });
  });

  describe('report button', () => {
    const mockOnReport = jest.fn();

    beforeEach(() => {
      mockOnReport.mockClear();
    });

    it('should show report button when authenticated and onReport provided', async () => {
      await renderWithI18n(
        <ReviewCard review={mockReview} mediaItemId={mediaItemId} isAuthenticated={true} onReport={mockOnReport} />,
      );

      expect(screen.getByText('Поскаржитись')).toBeInTheDocument();
    });

    it('should not show report button when not authenticated', async () => {
      await renderWithI18n(
        <ReviewCard review={mockReview} mediaItemId={mediaItemId} isAuthenticated={false} onReport={mockOnReport} />,
      );

      expect(screen.queryByText('Поскаржитись')).not.toBeInTheDocument();
    });

    it('should call onReport when report button clicked', async () => {
      await renderWithI18n(
        <ReviewCard review={mockReview} mediaItemId={mediaItemId} isAuthenticated={true} onReport={mockOnReport} />,
      );

      const reportButton = screen.getByText('Поскаржитись');
      await act(async () => {
        fireEvent.click(reportButton);
      });

      expect(mockOnReport).toHaveBeenCalledWith('review-id-1');
    });
  });
});
