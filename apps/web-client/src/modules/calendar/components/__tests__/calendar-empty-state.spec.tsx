/**
 * Tests for CalendarEmptyState component.
 *
 * Verifies that each variant renders the correct heading, subtitle,
 * and optional CTA link.
 */

import { render, screen } from '@testing-library/react';
import { CalendarEmptyState } from '../calendar-empty-state';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

jest.mock('@/shared/i18n', () => ({
  getDictionary: () => ({
    calendar: {
      noEpisodesWeek: 'На цьому тижні немає запланованих серій',
      tryAnotherWeek: 'Спробуйте інший тиждень',
      noEpisodesPersonalized: 'Немає запланованих серій',
      noEpisodesPersonalizedHint: 'У ваших серіалах немає нових серій на цьому тижні',
      noWatchingShows: 'Ви ще не дивитесь жодного серіалу',
      noWatchingShowsHint: 'Додайте серіали зі статусом «Дивлюсь», щоб бачити їх у персональному календарі',
      browseCatalog: 'Переглянути каталог',
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
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CalendarEmptyState', () => {
  describe('global variant (default)', () => {
    it('renders the no-episodes-this-week heading', () => {
      render(<CalendarEmptyState />);

      expect(screen.getByRole('heading')).toHaveTextContent(
        'На цьому тижні немає запланованих серій',
      );
    });

    it('renders the try-another-week subtitle', () => {
      render(<CalendarEmptyState />);

      expect(screen.getByText('Спробуйте інший тиждень')).toBeInTheDocument();
    });

    it('does not render a browse link', () => {
      render(<CalendarEmptyState />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('personalized variant', () => {
    it('renders the no-upcoming-episodes heading', () => {
      render(<CalendarEmptyState variant="personalized" />);

      expect(screen.getByRole('heading')).toHaveTextContent('Немає запланованих серій');
    });

    it('renders the personalized subtitle', () => {
      render(<CalendarEmptyState variant="personalized" />);

      expect(
        screen.getByText('У ваших серіалах немає нових серій на цьому тижні'),
      ).toBeInTheDocument();
    });

    it('does not render a browse link', () => {
      render(<CalendarEmptyState variant="personalized" />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('noWatchingShows variant', () => {
    it('renders the no-watching-shows heading', () => {
      render(<CalendarEmptyState variant="noWatchingShows" />);

      expect(screen.getByRole('heading')).toHaveTextContent(
        'Ви ще не дивитесь жодного серіалу',
      );
    });

    it('renders the hint subtitle', () => {
      render(<CalendarEmptyState variant="noWatchingShows" />);

      expect(
        screen.getByText(
          'Додайте серіали зі статусом «Дивлюсь», щоб бачити їх у персональному календарі',
        ),
      ).toBeInTheDocument();
    });

    it('renders a browse catalog link pointing to shows-trending', () => {
      render(<CalendarEmptyState variant="noWatchingShows" />);

      const link = screen.getByRole('link', { name: 'Переглянути каталог' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/browse/shows-trending');
    });
  });

  describe('global variant explicit', () => {
    it('renders the same as the default when variant="global"', () => {
      render(<CalendarEmptyState variant="global" />);

      expect(screen.getByRole('heading')).toHaveTextContent(
        'На цьому тижні немає запланованих серій',
      );
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });
});
