import type { MovieDetails } from '@/shared/api';
import { movieJsonLd } from './details-seo';

const MOVIE = {
  title: 'Одіссея',
  genres: [],
  stats: { ratingoScore: 83, communityAverageRating: 86.3, communityRatingCount: 3 },
  credits: {
    cast: [
      { personId: 'b', name: 'Том Голланд', character: '', order: 1 },
      { personId: 'a', name: 'Метт Деймон', character: '', order: 0 },
    ],
    crew: [{ personId: 'n', name: 'Крістофер Нолан', job: 'Director', department: 'Directing' }],
  },
} as unknown as MovieDetails;

describe('movieJsonLd', () => {
  it('rates with the community average and its own vote count', () => {
    expect(movieJsonLd(MOVIE).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 86.3,
      bestRating: 100,
      worstRating: 0,
      ratingCount: 3,
    });
  });

  it('leaves the rating out when nobody on Ratingo rated the title', () => {
    const unrated = { ...MOVIE, stats: { ...MOVIE.stats, communityRatingCount: 0 } };
    expect(movieJsonLd(unrated as MovieDetails).aggregateRating).toBeUndefined();
  });

  it('lists actors in billing order and directors from the crew', () => {
    const jsonLd = movieJsonLd(MOVIE);
    expect(jsonLd.actor).toEqual([
      { '@type': 'Person', name: 'Метт Деймон' },
      { '@type': 'Person', name: 'Том Голланд' },
    ]);
    expect(jsonLd.director).toEqual([{ '@type': 'Person', name: 'Крістофер Нолан' }]);
  });
});
