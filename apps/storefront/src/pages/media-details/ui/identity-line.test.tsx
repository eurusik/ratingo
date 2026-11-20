import { render, screen } from '@testing-library/react';
import type { MovieDetailsView, ShowDetailsView } from '../model/details-view';
import { IdentityLine } from './identity-line';

const movie: MovieDetailsView = {
  type: 'movie',
  mediaItemId: 'odyssey',
  slug: 'odyssey',
  title: 'Одіссея',
  genres: ['Пригоди'],
  externalRatings: [],
  community: { raters: [], ratingCount: 0 },
  credits: { cast: [], directors: [], writers: [], creators: [] },
  trailers: [],
};

describe('IdentityLine', () => {
  it('says the release date is not known yet for an undated movie in the works', () => {
    render(<IdentityLine view={{ ...movie, upcoming: 'undated' }} locale="uk" />);

    expect(screen.getByText('Дата виходу ще невідома')).toBeInTheDocument();
  });

  it('shows the release day of an upcoming movie', () => {
    const upcoming = {
      ...movie,
      upcoming: 'dated' as const,
      upcomingRelease: { date: '2026-12-25T00:00:00.000Z', kind: 'theatrical' as const },
    };
    render(<IdentityLine view={upcoming} locale="uk" />);

    expect(screen.getByText(/^Вихід .* · в кіно$/)).toBeInTheDocument();
    expect(screen.queryByText('Дата виходу ще невідома')).not.toBeInTheDocument();
  });

  describe('show', () => {
    const { runtimeMinutes: _runtime, status: _status, ...base } = movie;
    const show: ShowDetailsView = { ...base, type: 'show', showId: 'show-1', seasons: [] };

    it('shows the premiere day of a show that is not out yet', () => {
      render(
        <IdentityLine
          view={{ ...show, upcoming: 'dated', premiereDate: '2027-02-10T00:00:00.000Z' }}
          locale="uk"
        />,
      );

      expect(screen.getByText(/^Прем’єра /)).toBeInTheDocument();
    });

    it('says the premiere date is not known yet', () => {
      render(<IdentityLine view={{ ...show, upcoming: 'undated' }} locale="uk" />);

      expect(screen.getByText('Дата виходу ще невідома')).toBeInTheDocument();
    });

    it('shows no upcoming chip once the show is out', () => {
      render(<IdentityLine view={show} locale="uk" />);

      expect(screen.queryByText(/^Прем’єра /)).not.toBeInTheDocument();
      expect(screen.queryByText('Дата виходу ще невідома')).not.toBeInTheDocument();
    });
  });
});
