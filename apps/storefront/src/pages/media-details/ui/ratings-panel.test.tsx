import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import type { MovieDetailsView } from '../model/details-view';
import { RatingsPanel } from './ratings-panel';

const movie: MovieDetailsView = {
  type: 'movie',
  mediaItemId: 'werwulf',
  slug: 'werwulf',
  title: 'Вервульф',
  genres: [],
  score: 4.8,
  verdict: 'bad',
  verdictMessageKey: 'trendingNow',
  externalRatings: [],
  community: { raters: [], ratingCount: 0 },
  credits: { cast: [], directors: [], writers: [], creators: [] },
  trailers: [],
};

function inUkrainian(ui: ReactNode) {
  return render(
    <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
      {ui}
    </I18nProvider>,
  );
}

describe('RatingsPanel', () => {
  it('judges a released movie by its score', () => {
    inUkrainian(<RatingsPanel view={movie} locale="uk" />);

    expect(screen.getByText('Слабко')).toBeInTheDocument();
  });

  it('does not judge a movie that is not out yet', () => {
    const upcoming = {
      ...movie,
      upcoming: 'dated' as const,
      upcomingRelease: { date: '2026-12-25T00:00:00.000Z', kind: 'theatrical' as const },
    };
    inUkrainian(<RatingsPanel view={upcoming} locale="uk" />);

    expect(screen.queryByText('Слабко')).not.toBeInTheDocument();
    expect(
      screen.getByText('Фільм ще не вийшов — оцінки з’являться після прем’єри'),
    ).toBeInTheDocument();
  });

  it('does not judge a movie whose release date is not known yet', () => {
    inUkrainian(<RatingsPanel view={{ ...movie, upcoming: 'undated' }} locale="uk" />);

    expect(screen.queryByText('Слабко')).not.toBeInTheDocument();
    expect(
      screen.getByText('Фільм ще не вийшов — оцінки з’являться після прем’єри'),
    ).toBeInTheDocument();
  });
});
