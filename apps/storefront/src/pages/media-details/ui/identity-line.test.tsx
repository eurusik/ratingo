import { render, screen } from '@testing-library/react';
import type { MovieDetailsView } from '../model/details-view';
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
  isReleaseDateUnknown: false,
};

describe('IdentityLine', () => {
  it('says the release date is not known yet for an undated movie in the works', () => {
    render(<IdentityLine view={{ ...movie, isReleaseDateUnknown: true }} locale="uk" />);

    expect(screen.getByText('Дата виходу ще невідома')).toBeInTheDocument();
  });

  it('shows the release day of an upcoming movie', () => {
    const upcoming = {
      ...movie,
      upcomingRelease: { date: '2026-12-25T00:00:00.000Z', kind: 'theatrical' as const },
    };
    render(<IdentityLine view={upcoming} locale="uk" />);

    expect(screen.getByText(/^Вихід .* · в кіно$/)).toBeInTheDocument();
    expect(screen.queryByText('Дата виходу ще невідома')).not.toBeInTheDocument();
  });
});
