/**
 * Tests for DetailsHero component — CommunityRating integration.
 *
 * Covers: conditional rendering of CommunityRating based on
 * stats.communityAverageRating and stats.communityRatingCount presence.
 */

import { render, screen } from '@testing-library/react';
import type { DetailsHeroProps } from '../details-hero';
import { DetailsHero } from '../details-hero';

// ---------------------------------------------------------------------------
// Mocks — stub child components to isolate conditional rendering logic
// ---------------------------------------------------------------------------

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <div data-testid="next-image" {...props} />,
}));

jest.mock('@/shared/utils/format', () => ({
  formatYear: (date: string) => date.slice(0, 4),
}));

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ dict: {} }),
}));

jest.mock('../hero-backdrop', () => ({
  HeroBackdrop: () => <div data-testid="hero-backdrop" />,
}));

jest.mock('../ratingo-score', () => ({
  RatingoScore: (props: { score: number }) => (
    <div data-testid="ratingo-score">{props.score}</div>
  ),
}));

jest.mock('../community-rating', () => ({
  CommunityRating: (props: { averageRating: number; ratingCount: number }) => (
    <div data-testid="community-rating">
      {props.averageRating} / {props.ratingCount}
    </div>
  ),
}));

jest.mock('../rating-presets', () => ({
  RatingPresets: () => <div data-testid="rating-presets" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_PROPS: DetailsHeroProps = {
  title: 'Test Movie',
  releaseDate: '2024-01-15',
  genres: [{ id: 1, name: 'Drama' }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DetailsHero — CommunityRating integration', () => {
  it('renders CommunityRating when both communityAverageRating and communityRatingCount are present', () => {
    render(
      <DetailsHero
        {...BASE_PROPS}
        stats={{
          qualityScore: 80,
          communityAverageRating: 75,
          communityRatingCount: 42,
        }}
      />,
    );

    expect(screen.getByTestId('community-rating')).toBeInTheDocument();
    expect(screen.getByTestId('community-rating')).toHaveTextContent('75 / 42');
  });

  it('does NOT render CommunityRating when communityAverageRating is null', () => {
    render(
      <DetailsHero
        {...BASE_PROPS}
        stats={{
          qualityScore: 80,
          communityAverageRating: null,
          communityRatingCount: 42,
        }}
      />,
    );

    expect(screen.queryByTestId('community-rating')).not.toBeInTheDocument();
  });

  it('does NOT render CommunityRating when communityRatingCount is null', () => {
    render(
      <DetailsHero
        {...BASE_PROPS}
        stats={{
          qualityScore: 80,
          communityAverageRating: 75,
          communityRatingCount: null,
        }}
      />,
    );

    expect(screen.queryByTestId('community-rating')).not.toBeInTheDocument();
  });

  it('does NOT render CommunityRating when stats is null', () => {
    render(<DetailsHero {...BASE_PROPS} stats={null} />);

    expect(screen.queryByTestId('community-rating')).not.toBeInTheDocument();
  });
});
