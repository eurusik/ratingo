import type { MovieDetails, ShowDetails } from '@/shared/api';
import { fromMovieDetails, fromShowDetails } from './details-view';

const MOVIE = {
  id: 'odyssey-id',
  slug: 'odisseya',
  title: 'Одіссея',
  overview: '  Епос Гомера.  ',
  releaseDate: '2026-07-15T00:00:00.000Z',
  genres: [{ id: 'g1', name: 'Пригоди', slug: 'pryhody' }],
  runtime: 173,
  budget: 250000000,
  revenue: 0,
  status: 'Released',
  stats: {
    qualityScore: 92.08,
    liveWatchers: 17,
    totalWatchers: 92771,
    communityAverageRating: 86.33,
    communityRatingCount: 3,
    recentRaters: [],
  },
  externalRatings: {
    imdb: { rating: 8.4 },
    trakt: { rating: 8.75293 },
    metacritic: { rating: 88 },
    rottenTomatoes: { rating: 94 },
    rottenTomatoesAudience: null,
  },
  verdict: { type: 'popularity', messageKey: 'trendingNow', hintKey: 'forLater' },
} as unknown as MovieDetails;

describe('fromMovieDetails', () => {
  const view = fromMovieDetails(MOVIE);

  it('shows the quality score out of 10 with its verdict', () => {
    expect(view.score).toBeCloseTo(9.208);
    expect(view.verdict).toBe('good');
    expect(view.verdictMessageKey).toBe('trendingNow');
  });

  it('keeps only ratings that exist, in the hero order, with Trakt as a percent', () => {
    expect(view.externalRatings).toEqual([
      { source: 'imdb', value: 8.4 },
      { source: 'rtCritics', value: 94 },
      { source: 'metacritic', value: 88 },
      { source: 'trakt', value: expect.closeTo(87.53, 2) },
    ]);
  });

  it('drops empty facts and trims the overview', () => {
    expect(view.overview).toBe('Епос Гомера.');
    expect(view.revenue).toBeUndefined();
    expect(view.budget).toBe(250000000);
    expect(view.year).toBe(2026);
    expect(view.community.averageScore).toBeCloseTo(8.633);
  });

  it('leaves the score empty when the API has none', () => {
    const unrated = fromMovieDetails({ ...MOVIE, stats: null });
    expect(unrated.score).toBeUndefined();
    expect(unrated.verdict).toBeUndefined();
    expect(unrated.community).toEqual({ raters: [], ratingCount: 0, averageScore: undefined });
  });

  it.each([
    ['in production', 'In Production', true],
    ['only rumored', 'Rumored', true],
    ['released', 'Released', false],
    ['without a status', null, false],
  ])('treats an undated movie that is %s accordingly', (_case, status, isUnknown) => {
    const undated = fromMovieDetails({ ...MOVIE, releaseDate: null, status } as MovieDetails);
    expect(undated.isReleaseDateUnknown).toBe(isUnknown);
    expect(undated.upcomingRelease).toBeUndefined();
  });

  it('knows the release date of a dated movie in production', () => {
    const dated = fromMovieDetails({ ...MOVIE, status: 'Post Production' });
    expect(dated.isReleaseDateUnknown).toBe(false);
  });

  it('has no upcoming release once the movie is out', () => {
    expect(view.upcomingRelease).toBeUndefined();
  });

  it.each([
    [
      'the theatrical date first',
      { theatricalReleaseDate: '2026-12-18T00:00:00.000Z', digitalReleaseDate: '2027-02-01' },
      { date: '2026-12-18T00:00:00.000Z', kind: 'theatrical' },
    ],
    [
      'the digital date for streaming premieres',
      { theatricalReleaseDate: null, digitalReleaseDate: '2026-12-24T00:00:00.000Z' },
      { date: '2026-12-24T00:00:00.000Z', kind: 'digital' },
    ],
    [
      'the primary date as a fallback',
      {},
      { date: '2026-07-15T00:00:00.000Z', kind: 'theatrical' },
    ],
  ])('dates an upcoming movie by %s', (_case, dates, expected) => {
    const upcoming = fromMovieDetails({ ...MOVIE, ...dates, releaseStatus: 'upcoming' });
    expect(upcoming.upcomingRelease).toEqual(expected);
  });
});

describe('fromShowDetails', () => {
  it('carries seasons, episodes and the show status', () => {
    const show = fromShowDetails({
      ...MOVIE,
      showId: 'show-1',
      seasons: [{ number: 1, episodes: [{ id: 'e1', number: 1 }] }],
      totalSeasons: 2,
      totalEpisodes: 20,
      status: 'Returning Series',
      lastAirDate: '2026-10-30T12:00:00.000Z',
    } as unknown as ShowDetails);

    expect(show).toMatchObject({
      type: 'show',
      showId: 'show-1',
      seasons: [{ number: 1, episodes: [{ id: 'e1', seasonNumber: 1, number: 1 }] }],
      seasonCount: 2,
      episodeCount: 20,
      status: 'Returning Series',
    });
  });
});
