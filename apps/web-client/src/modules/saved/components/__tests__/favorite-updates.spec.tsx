/**
 * Tests for FavoriteUpdates component event label logic.
 */

import { render, screen } from '@testing-library/react';
import type { FavoriteUpdateItem } from '@/core/api/me-lists.client';
import { useAuth } from '@/core/auth';
import { FavoriteUpdates } from '../favorite-updates';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

jest.mock('@/core/auth', () => ({
  useAuth: jest.fn(() => ({ isAuthenticated: true })),
}));

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ dict: {} }),
  useLocale: () => 'uk',
}));

jest.mock('@/shared/utils/format', () => ({
  formatRelativeDate: jest.fn(() => ({ text: '2 дні тому' })),
}));

const mockUseFavoriteUpdates = jest.fn();
jest.mock('../../hooks/use-me-lists', () => ({
  useFavoriteUpdates: (...args: unknown[]) => mockUseFavoriteUpdates(...args),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill, ...props }: Record<string, unknown>) => <img {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeItem(overrides: Partial<FavoriteUpdateItem> = {}): FavoriteUpdateItem {
  return {
    mediaItemId: 'item-1',
    rating: 85,
    mediaSummary: {
      type: 'show',
      slug: 'test-show',
      title: 'Test Show',
      poster: { medium: 'https://example.com/poster.jpg' },
    },
    latestEpisode: null,
    nextEpisode: null,
    ...overrides,
  } as FavoriteUpdateItem;
}

function makeEpisode(overrides: Record<string, unknown> = {}) {
  return {
    seasonNumber: 2,
    episodeNumber: 5,
    title: 'Episode Title',
    airDate: '2025-05-10',
    isBatchRelease: false,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('FavoriteUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
  });

  it('shows "Наступний епізод" when nextEpisode exists', () => {
    const item = makeItem({ nextEpisode: makeEpisode() });
    mockUseFavoriteUpdates.mockReturnValue({
      data: { data: [item] },
      isLoading: false,
    });

    render(<FavoriteUpdates />);

    expect(screen.getByText(/Наступний епізод/)).toBeInTheDocument();
  });

  it('shows "Новий епізод" when only latestEpisode exists and isBatchRelease is false', () => {
    const item = makeItem({
      latestEpisode: makeEpisode({ isBatchRelease: false }),
    });
    mockUseFavoriteUpdates.mockReturnValue({
      data: { data: [item] },
      isLoading: false,
    });

    render(<FavoriteUpdates />);

    expect(screen.getByText(/Новий епізод/)).toBeInTheDocument();
  });

  it('shows "Новий сезон" when only latestEpisode exists and isBatchRelease is true', () => {
    const item = makeItem({
      latestEpisode: makeEpisode({ isBatchRelease: true }),
    });
    mockUseFavoriteUpdates.mockReturnValue({
      data: { data: [item] },
      isLoading: false,
    });

    render(<FavoriteUpdates />);

    expect(screen.getByText(/Новий сезон/)).toBeInTheDocument();
  });

  it('shows empty state message when no items', () => {
    mockUseFavoriteUpdates.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    render(<FavoriteUpdates />);

    expect(
      screen.getByText('Оціни серіали, щоб бачити оновлення тут'),
    ).toBeInTheDocument();
  });

  it('returns null when not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });

    mockUseFavoriteUpdates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    const { container } = render(<FavoriteUpdates />);

    expect(container.firstChild).toBeNull();
  });
});
