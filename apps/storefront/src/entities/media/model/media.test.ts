import fc from 'fast-check';
import type { MediaBadge, TrendingMovie, TrendingShow } from '@/shared/api';
import { EVENT_BADGES, fromTrendingMovie, fromTrendingShow, toEventBadge } from './media';

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
  stats: { ratingoScore: 94, qualityScore: 62 },
  externalRatings: { imdb: { rating: 8.3, voteCount: 131558 }, rottenTomatoes: { rating: 76 } },
  card: { badgeKey: 'IN_THEATERS', primaryCta: 'SAVE' },
} as TrendingMovie;

const SHOW = {
  mediaItemId: 'show-1',
  slug: 'andor',
  title: 'Андор',
  releaseDate: null,
  poster: null,
  stats: { ratingoScore: null, qualityScore: null },
  externalRatings: { imdb: null },
  card: { badgeKey: 'TRENDING', primaryCta: 'SAVE' },
} as unknown as TrendingShow;

const ALL_BADGES: MediaBadge[] = [
  'NEW_EPISODE',
  'CONTINUE',
  'IN_WATCHLIST',
  'HIT',
  'NEW_RELEASE',
  'RISING',
  'TRENDING',
  'IN_THEATERS',
  'NEW_ON_STREAMING',
];

describe('trending mappers', () => {
  it('takes the IMDb rating and critics score, judges by quality rather than popularity and keeps event badges', () => {
    expect(fromTrendingMovie(MOVIE)).toEqual({
      mediaItemId: 'movie-1',
      type: 'movie',
      slug: 'dune-2021',
      title: 'Дюна',
      year: 2021,
      posterUrl: POSTER.small,
      backdropUrl: POSTER.small,
      imdbRating: 8.3,
      criticsPercent: 76,
      verdict: 'mixed',
      eventBadge: 'IN_THEATERS',
      providers: [],
    });
  });

  it('leaves out what a show does not have and hides the trending badge', () => {
    expect(fromTrendingShow(SHOW)).toMatchObject({
      type: 'show',
      year: undefined,
      posterUrl: undefined,
      backdropUrl: undefined,
      imdbRating: undefined,
      criticsPercent: undefined,
      verdict: undefined,
      eventBadge: undefined,
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

describe('toEventBadge', () => {
  it('keeps only badges that tell about an event', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_BADGES, null, undefined), (badge) => {
        const event = toEventBadge(badge);
        expect(event === undefined || EVENT_BADGES.includes(event)).toBe(true);
        expect(event !== undefined).toBe(EVENT_BADGES.some((known) => known === badge));
      }),
    );
  });
});
