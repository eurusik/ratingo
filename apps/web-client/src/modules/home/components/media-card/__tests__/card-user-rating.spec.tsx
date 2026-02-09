import { render, screen } from '@testing-library/react';
import { CardUserRating } from '../card-user-rating';

const mockGetRating = jest.fn();
let mockContext: { getRating: jest.Mock } | null = { getRating: mockGetRating };

jest.mock('@/core/user-rating', () => ({
  useUserRatingContext: () => mockContext,
}));

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ dict: { card: { yourRating: 'Your rating: {rating}' } } }),
}));

jest.mock('@/shared/components/user-rating-badge', () => ({
  UserRatingBadge: ({ rating, label, className }: { rating: number; label?: string; className: string }) => (
    <div data-testid="user-rating-badge" data-rating={rating} data-label={label} className={className} />
  ),
}));

describe('CardUserRating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = { getRating: mockGetRating };
  });

  it('returns null when context is null (outside provider)', () => {
    mockContext = null;

    const { container } = render(<CardUserRating mediaItemId="test-media-id" />);

    expect(container.firstChild).toBeNull();
    expect(mockGetRating).not.toHaveBeenCalled();
  });

  it('returns null when getRating returns undefined', () => {
    mockGetRating.mockReturnValue(undefined);

    const { container } = render(<CardUserRating mediaItemId="test-media-id" />);

    expect(container.firstChild).toBeNull();
    expect(mockGetRating).toHaveBeenCalledWith('test-media-id');
    expect(screen.queryByTestId('user-rating-badge')).not.toBeInTheDocument();
  });

  it('returns null when getRating returns null', () => {
    mockGetRating.mockReturnValue(null);

    const { container } = render(<CardUserRating mediaItemId="test-media-id" />);

    expect(container.firstChild).toBeNull();
    expect(mockGetRating).toHaveBeenCalledWith('test-media-id');
    expect(screen.queryByTestId('user-rating-badge')).not.toBeInTheDocument();
  });

  it('renders UserRatingBadge with correct rating and className when rating exists', () => {
    mockGetRating.mockReturnValue(8);

    render(<CardUserRating mediaItemId="test-media-id" />);

    const badge = screen.getByTestId('user-rating-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-rating', '8');
    expect(badge).toHaveClass('absolute', 'bottom-2', 'left-2', 'z-10');
  });

  it('passes correct mediaItemId to getRating', () => {
    const mediaItemId = 'unique-media-id-123';
    mockGetRating.mockReturnValue(7);

    render(<CardUserRating mediaItemId={mediaItemId} />);

    expect(mockGetRating).toHaveBeenCalledWith(mediaItemId);
    expect(mockGetRating).toHaveBeenCalledTimes(1);
  });

  it('renders UserRatingBadge with rating 0 when getRating returns 0', () => {
    mockGetRating.mockReturnValue(0);

    render(<CardUserRating mediaItemId="test-media-id" />);

    const badge = screen.getByTestId('user-rating-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-rating', '0');
  });

  it('renders UserRatingBadge with rating 10 when getRating returns 10', () => {
    mockGetRating.mockReturnValue(10);

    render(<CardUserRating mediaItemId="test-media-id" />);

    const badge = screen.getByTestId('user-rating-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-rating', '10');
  });
});
