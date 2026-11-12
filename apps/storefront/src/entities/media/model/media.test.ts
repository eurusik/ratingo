import fc from 'fast-check';
import type { TrendingMovie, TrendingShow } from '@/shared/api';
import { fromTrendingMovie, fromTrendingShow } from './media';

const POSTER = {
  thumb: 'https://image.tmdb.org/t/p/w154/a.jpg',
  small: 'https://image.tmdb.org/t/p/w342/a.jpg',
  medium: 'https://image.tmdb.org/t/p/w500/a.jpg',
  large: 'https://image.tmdb.org/t/p/w780/a.jpg',
  original: 'https://image.tmdb.org/t/p/original/a.jpg',
};

const MOVIE = {
  mediaItemId: 'movie-1',
  slug: 'dune-2021',
  title: 'Дюна',
  releaseDate: '2021-09-15',
  poster: POSTER,
  backdrop: POSTER,
  stats: { ratingoScore: 84 },
  card: { badgeKey: 'HIT', primaryCta: 'SAVE' },
} as TrendingMovie;

const SHOW = {
  mediaItemId: 'show-1',
  slug: 'andor',
  title: 'Андор',
  releaseDate: null,
  poster: null,
  isNew: true,
  stats: { ratingoScore: null },
} as unknown as TrendingShow;

describe('trending mappers', () => {
  it('maps a movie with its score, year, poster and badge', () => {
    expect(fromTrendingMovie(MOVIE)).toEqual({
      mediaItemId: 'movie-1',
      type: 'movie',
      slug: 'dune-2021',
      title: 'Дюна',
      year: 2021,
      posterUrl: POSTER.small,
      backdropUrl: POSTER.small,
      score: 8.4,
      badge: 'HIT',
      providers: [],
    });
  });

  it('marks a new show as new in the top and leaves missing data out', () => {
    expect(fromTrendingShow(SHOW)).toMatchObject({
      type: 'show',
      rankChange: { kind: 'new' },
      backdropUrl: undefined,
      year: undefined,
      posterUrl: undefined,
      score: undefined,
      badge: undefined,
    });
  });

  it('reads the year from any ISO date', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1888, max: 2100 }), (year) => {
        const movie = { ...MOVIE, releaseDate: `${year}-01-01` };
        expect(fromTrendingMovie(movie).year).toBe(year);
      }),
    );
  });
});
