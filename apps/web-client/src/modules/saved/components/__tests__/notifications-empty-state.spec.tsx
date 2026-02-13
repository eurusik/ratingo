/**
 * Tests for NotificationsEmptyState component rendering and accessibility.
 */

import { render, screen } from '@testing-library/react';
import { NotificationsEmptyState } from '../notifications-empty-state';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
      notifications: {
        emptyState: {
          allRead: 'Все прочитано',
          noNotifications: 'Немає сповіщень',
          allReadDescription: 'Опис все прочитано',
          noNotificationsDescription: 'Опис немає сповіщень',
          browseShows: 'Серіали',
          browseMovies: 'Фільми',
        },
      },
    },
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('NotificationsEmptyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders h2 heading for all-read variant', () => {
    render(<NotificationsEmptyState variant="all-read" />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Все прочитано');
  });

  it('renders h2 heading for no-notifications variant', () => {
    render(<NotificationsEmptyState variant="no-notifications" />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Немає сповіщень');
  });

  it.each(['all-read', 'no-notifications'] as const)(
    'shows browse links for %s variant',
    (variant) => {
      render(<NotificationsEmptyState variant={variant} />);

      const showsLink = screen.getByRole('link', { name: 'Серіали' });
      expect(showsLink).toHaveAttribute('href', '/browse/shows');

      const moviesLink = screen.getByRole('link', { name: 'Фільми' });
      expect(moviesLink).toHaveAttribute('href', '/browse/movies');
    },
  );
});
