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
    expect(undated.upcoming).toBe(isUnknown ? 'undated' : undefined);
    expect(undated.upcomingRelease).toBeUndefined();
  });

  it('knows the release date of a dated movie in production', () => {
    const dated = fromMovieDetails({ ...MOVIE, status: 'Post Production' });
    expect(dated.upcoming).not.toBe('undated');
  });

  it('has no upcoming release once the movie is out', () => {
    expect(view.upcomingRelease).toBeUndefined();
    expect(view.upcoming).toBeUndefined();
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
  const NOW = new Date('2026-11-20T12:00:00.000Z');
  const SHOW = {
    ...MOVIE,
    showId: 'show-1',
    seasons: [{ number: 1, episodes: [{ id: 'e1', number: 1 }] }],
    totalSeasons: 2,
    totalEpisodes: 20,
    status: 'Returning Series',
    lastAirDate: '2026-10-30T12:00:00.000Z',
  } as unknown as ShowDetails;

  it('carries seasons, episodes and the show status', () => {
    const show = fromShowDetails(SHOW, NOW);

    expect(show).toMatchObject({
      type: 'show',
      showId: 'show-1',
      seasons: [{ number: 1, episodes: [{ id: 'e1', seasonNumber: 1, number: 1 }] }],
      seasonCount: 2,
      episodeCount: 20,
      status: 'Returning Series',
    });
  });

  it('has no premiere once the show is out', () => {
    const show = fromShowDetails(SHOW, NOW);
    expect(show.premiereDate).toBeUndefined();
    expect(show.upcoming).toBeUndefined();
  });

  it('knows the premiere date of a show that is not out yet', () => {
    const show = fromShowDetails(
      { ...SHOW, status: 'In Production', releaseDate: '2027-02-10T00:00:00.000Z' },
      NOW,
    );
    expect(show.premiereDate).toBe('2027-02-10T00:00:00.000Z');
    expect(show.upcoming).toBe('dated');
  });

  it('is out once an episode has aired, even if the first air date says otherwise', () => {
    const show = fromShowDetails(
      {
        ...SHOW,
        releaseDate: '2027-02-10T00:00:00.000Z',
        seasons: [
          { number: 1, episodes: [{ id: 'e1', number: 1, airDate: '2026-11-01T00:00:00.000Z' }] },
        ],
      } as unknown as ShowDetails,
      NOW,
    );
    expect(show.premiereDate).toBeUndefined();
    expect(show.upcoming).toBeUndefined();
  });

  it.each([
    ['Planned', true],
    ['In Production', true],
    ['Pilot', true],
    ['Returning Series', false],
    ['Ended', false],
  ])('treats an undated %s show as date unknown: %s', (status, isUnknown) => {
    const show = fromShowDetails(
      { ...SHOW, status, releaseDate: null } as unknown as ShowDetails,
      NOW,
    );
    expect(show.upcoming).toBe(isUnknown ? 'undated' : undefined);
    expect(show.premiereDate).toBeUndefined();
  });
});
