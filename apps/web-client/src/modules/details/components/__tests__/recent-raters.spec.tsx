/**
 * Tests for RecentRaters component.
 *
 * Covers: null when empty, null when undefined, correct avatar count,
 * fallback initials, and avatar image rendering.
 */

import { render, screen } from '@testing-library/react';
import { RecentRaters } from '../recent-raters';

// ---------------------------------------------------------------------------
// Mocks — Radix AvatarFallback only renders after AvatarImage load failure,
// so we stub the avatar primitives for deterministic unit tests.
// ---------------------------------------------------------------------------

jest.mock('@/shared/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="avatar" {...props}>{children}</div>
  ),
  AvatarImage: (props: { src: string; alt: string }) => (
    <img data-testid="avatar-image" src={props.src} alt={props.alt} />
  ),
  AvatarFallback: ({ children }: React.PropsWithChildren) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRater = (id: number, avatarUrl: string | null = null) => ({
  userId: `user-${id}`,
  username: `user${id}`,
  avatarUrl,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecentRaters', () => {
  it('returns null when raters array is empty', () => {
    const { container } = render(<RecentRaters raters={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('returns null when raters is undefined', () => {
    const { container } = render(<RecentRaters raters={undefined as never} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders correct number of avatars for 1 rater', () => {
    render(<RecentRaters raters={[makeRater(1)]} />);

    expect(screen.getAllByTestId('avatar')).toHaveLength(1);
  });

  it('renders correct number of avatars for 2 raters', () => {
    render(<RecentRaters raters={[makeRater(1), makeRater(2)]} />);

    expect(screen.getAllByTestId('avatar')).toHaveLength(2);
  });

  it('renders correct number of avatars for 3 raters', () => {
    render(
      <RecentRaters raters={[makeRater(1), makeRater(2), makeRater(3)]} />,
    );

    expect(screen.getAllByTestId('avatar')).toHaveLength(3);
  });

  it('shows fallback initial (first letter uppercase) when no avatarUrl', () => {
    render(<RecentRaters raters={[makeRater(1)]} />);

    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('U');
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
  });

  it('renders avatar image when avatarUrl is provided', () => {
    render(
      <RecentRaters
        raters={[makeRater(1, 'https://example.com/avatar.jpg')]}
      />,
    );

    const img = screen.getByTestId('avatar-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'user1');
  });

  // =========================================================================
  // Overflow indicator (+N)
  // =========================================================================

  describe('overflow indicator', () => {
    it('shows +N when totalCount exceeds 3 visible avatars', () => {
      render(
        <RecentRaters
          raters={[makeRater(1), makeRater(2), makeRater(3)]}
          totalCount={42}
        />,
      );

      expect(screen.getAllByTestId('avatar')).toHaveLength(3);
      expect(screen.getByText('+39')).toBeInTheDocument();
    });

    it('caps overflow display at +99 for large counts', () => {
      render(
        <RecentRaters
          raters={[makeRater(1), makeRater(2), makeRater(3)]}
          totalCount={500}
        />,
      );

      expect(screen.getByText('+99')).toBeInTheDocument();
      expect(screen.queryByText('+497')).not.toBeInTheDocument();
    });

    it('does not show overflow when totalCount equals raters length', () => {
      render(
        <RecentRaters
          raters={[makeRater(1), makeRater(2)]}
          totalCount={2}
        />,
      );

      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });

    it('does not show overflow when totalCount is not provided and raters <= 3', () => {
      render(
        <RecentRaters raters={[makeRater(1), makeRater(2), makeRater(3)]} />,
      );

      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });
  });
});
