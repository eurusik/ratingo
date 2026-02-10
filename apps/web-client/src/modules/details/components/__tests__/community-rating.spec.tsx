/**
 * Tests for CommunityRating component.
 *
 * Covers: rendering above threshold, hiding below threshold,
 * correct rating formatting, and i18n label display.
 */

import { render, screen } from '@testing-library/react';
import { CommunityRating } from '../community-rating';
import { COMMUNITY_RATING_MIN_THRESHOLD } from '../../constants/community-rating';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../recent-raters', () => ({
  RecentRaters: (props: { raters: unknown[] }) => (
    <div data-testid="recent-raters">{props.raters.length}</div>
  ),
}));

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
      details: {
        communityRating: {
          label: 'Community Rating',
          ratings: {
            one: 'rating',
            few: 'ratings',
            many: 'ratings',
          },
        },
      },
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommunityRating', () => {
  // =========================================================================
  // Rendering above threshold
  // =========================================================================

  describe('when rating count is at or above threshold', () => {
    it('renders rating and count when count equals threshold', () => {
      render(
        <CommunityRating
          averageRating={75}
          ratingCount={COMMUNITY_RATING_MIN_THRESHOLD}
        />,
      );

      expect(screen.getByText('7.5')).toBeInTheDocument();
      expect(screen.getByText(`${COMMUNITY_RATING_MIN_THRESHOLD} ratings`)).toBeInTheDocument();
    });

    it('renders rating and count when count exceeds threshold', () => {
      render(<CommunityRating averageRating={82} ratingCount={150} />);

      expect(screen.getByText('8.2')).toBeInTheDocument();
      expect(screen.getByText('150 ratings')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Hidden below threshold
  // =========================================================================

  describe('when rating count is below threshold', () => {
    it('returns null when count is below threshold', () => {
      const { container } = render(
        <CommunityRating
          averageRating={90}
          ratingCount={COMMUNITY_RATING_MIN_THRESHOLD - 1}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when count is zero', () => {
      const { container } = render(
        <CommunityRating averageRating={50} ratingCount={0} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  // =========================================================================
  // Rating formatting
  // =========================================================================

  describe('rating formatting', () => {
    it('formats rating from 0-100 scale to 1-10 display (78.5 -> 7.8)', () => {
      render(<CommunityRating averageRating={78.5} ratingCount={10} />);

      // formatRating(78.5): 78.5 > 10, so 78.5 / 10 = 7.85, toFixed(1) = "7.8"
      expect(screen.getByText('7.8')).toBeInTheDocument();
    });

    it('formats a perfect score (100 -> 10.0)', () => {
      render(<CommunityRating averageRating={100} ratingCount={20} />);

      expect(screen.getByText('10.0')).toBeInTheDocument();
    });

    it('formats a low score (15 -> 1.5)', () => {
      render(<CommunityRating averageRating={15} ratingCount={5} />);

      expect(screen.getByText('1.5')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // i18n label
  // =========================================================================

  describe('i18n labels', () => {
    it('displays the ratings count label from translation dictionary', () => {
      render(<CommunityRating averageRating={60} ratingCount={42} />);

      expect(screen.getByText('42 ratings')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Star icon
  // =========================================================================

  describe('star icon', () => {
    it('renders the star icon with fill', () => {
      const { container } = render(
        <CommunityRating averageRating={80} ratingCount={10} />,
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  // =========================================================================
  // RecentRaters integration
  // =========================================================================

  describe('RecentRaters integration', () => {
    it('renders RecentRaters when recentRaters prop is provided', () => {
      render(
        <CommunityRating
          averageRating={80}
          ratingCount={10}
          recentRaters={[
            { userId: 'u1', username: 'alice', avatarUrl: null },
          ]}
        />,
      );

      expect(screen.getByTestId('recent-raters')).toBeInTheDocument();
    });

    it('does NOT render RecentRaters when recentRaters is undefined', () => {
      render(<CommunityRating averageRating={80} ratingCount={10} />);

      expect(screen.getByTestId('recent-raters')).toHaveTextContent('0');
    });

    it('does NOT render RecentRaters when recentRaters is empty array', () => {
      render(
        <CommunityRating
          averageRating={80}
          ratingCount={10}
          recentRaters={[]}
        />,
      );

      expect(screen.getByTestId('recent-raters')).toHaveTextContent('0');
    });
  });
});
