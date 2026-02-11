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

  it('shows browse shows link for all-read variant', () => {
    render(<NotificationsEmptyState variant="all-read" />);

    const link = screen.getByRole('link', { name: 'Серіали' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/shows');
  });

  it('shows both browse links for no-notifications variant', () => {
    render(<NotificationsEmptyState variant="no-notifications" />);

    const showsLink = screen.getByRole('link', { name: 'Серіали' });
    expect(showsLink).toBeInTheDocument();
    expect(showsLink).toHaveAttribute('href', '/shows');

    const moviesLink = screen.getByRole('link', { name: 'Фільми' });
    expect(moviesLink).toBeInTheDocument();
    expect(moviesLink).toHaveAttribute('href', '/movies');
  });
});
