/**
 * Tests for NotificationCard component rendering and accessibility.
 */

import { render, screen } from '@testing-library/react';
import type { components } from '@ratingo/api-contract';
import { NotificationCard } from '../notification-card';

type NotificationItem = components['schemas']['NotificationItemDto'];

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
      notifications: {
        events: {
          released: "Прем'єра",
          newSeason: 'Новий сезон',
          newEpisode: 'Новий епізод',
          onStreaming: 'На стримінгу',
          statusChanged: 'Зміна статусу',
        },
        context: { season: 'Сезон {number}' },
      },
    },
    locale: 'uk',
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill, ...props }: Record<string, unknown>) => <img {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children as React.ReactNode}</a>,
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeProps(
  overrides: Partial<Omit<NotificationItem, 'id'>> = {},
): Omit<NotificationItem, 'id'> {
  return {
    trigger: 'new_season',
    payload: null,
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    mediaSummary: {
      id: 'media-1',
      type: 'show',
      title: 'Breaking Bad',
      slug: 'breaking-bad',
      poster: {
        small: 'https://example.com/poster-sm.jpg',
        medium: 'https://example.com/poster-md.jpg',
        large: 'https://example.com/poster-lg.jpg',
      },
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('NotificationCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders media title', () => {
    const props = makeProps({ mediaSummary: { id: 'media-2', type: 'show', title: 'Dark', slug: 'dark', poster: null } });

    render(<NotificationCard {...props} />);

    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('renders trigger label for new_season', () => {
    const props = makeProps({ trigger: 'new_season' });

    render(<NotificationCard {...props} />);

    expect(screen.getByText(/Новий сезон/)).toBeInTheDocument();
  });

  it('renders season context', () => {
    const props = makeProps({
      trigger: 'new_season',
      payload: { seasonNumber: 5 },
    });

    render(<NotificationCard {...props} />);

    expect(screen.getByText(/Сезон 5/)).toBeInTheDocument();
  });

  it('has aria-hidden on dot span', () => {
    const props = makeProps();

    const { container } = render(<NotificationCard {...props} />);

    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('shows unread indicator', () => {
    const props = makeProps({ isRead: false });

    const { container } = render(<NotificationCard {...props} />);

    const card = container.firstElementChild;
    expect(card?.className).toContain('border-l-blue-500');
  });

  it('links to /shows/{slug} for show notifications', () => {
    const props = makeProps({
      mediaSummary: { id: 'show-1', type: 'show', title: 'Breaking Bad', slug: 'breaking-bad', poster: null },
    });

    render(<NotificationCard {...props} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/shows/breaking-bad');
  });

  it('links to /movies/{slug} for movie notifications', () => {
    const props = makeProps({
      mediaSummary: { id: 'movie-1', type: 'movie', title: 'Inception', slug: 'inception', poster: null },
    });

    render(<NotificationCard {...props} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/movies/inception');
  });

  it('renders relative time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 1000 * 60 * 5).toISOString();
    const props = makeProps({ createdAt: fiveMinutesAgo });

    render(<NotificationCard {...props} />);

    // formatRelativeTime with 'uk' locale produces Ukrainian relative time via Intl.RelativeTimeFormat
    const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' });
    const expected = rtf.format(-5, 'minute');

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
