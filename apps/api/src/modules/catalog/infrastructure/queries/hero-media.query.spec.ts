import { HeroMediaQuery } from './hero-media.query';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { HERO_THRESHOLDS } from '../../domain/constants/catalog.constants';

// Chainable thenable factory for Drizzle-like API
const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit'];
  methods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('HeroMediaQuery', () => {
  let query: HeroMediaQuery;
  let db: any;
  let selectQueue: any[];

  beforeEach(() => {
    jest.spyOn(ImageMapper, 'toPoster').mockReturnValue({ small: 'poster' } as any);
    jest.spyOn(ImageMapper, 'toBackdrop').mockReturnValue({ small: 'backdrop' } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = (selections: any[][], reject?: Error) => {
    selectQueue = [...selections];
    db = {
      select: jest.fn().mockImplementation(() => {
        const data = selectQueue.shift() ?? [];
        return createThenable(data, reject);
      }),
    };

    query = new HeroMediaQuery(db as any);
  };

  it('should map hero items with show progress and movie flags', async () => {
    const now = new Date();
    // First select (strict pass): base media results (one movie, one show)
    const mediaRows = [
      {
        id: 'm1',
        type: MediaType.MOVIE,
        slug: 'movie',
        title: 'Movie',
        originalTitle: 'Movie',
        overview: 'ov',
        posterPath: '/p.jpg',
        backdropPath: '/b.jpg',
        releaseDate: new Date(now.getTime() - 6 * 365 * 24 * 60 * 60 * 1000), // classic
        videos: [{ key: 'trailer1' }],
        ratingoScore: 0.8,
        qualityScore: 70,
        watchersCount: 10,
        totalWatchers: 20,
        rating: 8,
        voteCount: 1000,
      },
      {
        id: 's1',
        type: MediaType.SHOW,
        slug: 'show',
        title: 'Show',
        originalTitle: 'Show',
        overview: 'ov',
        posterPath: '/p2.jpg',
        backdropPath: '/b2.jpg',
        releaseDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // new
        videos: [],
        ratingoScore: 0.9,
        qualityScore: 80,
        watchersCount: 5,
        totalWatchers: 15,
        rating: 9,
        voteCount: 500,
      },
    ];

    // Second select (fallback pass): empty since strict returned < limit
    const fallbackRows: any[] = [];

    // Third select: shows data
    const showsData = [
      {
        mediaItemId: 's1',
        showId: 'sh1',
        lastAirDate: new Date('2024-01-01'),
        nextAirDate: new Date('2025-01-01'),
      },
    ];

    // Fourth select: episodes data (latest first)
    const episodes = [
      {
        showId: 'sh1',
        seasonNum: 2,
        episodeNumber: 3,
        airDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    setup([mediaRows, fallbackRows, showsData, episodes]);

    const result = await query.execute({ limit: 5 });

    expect(result).toHaveLength(2);

    const movie = result.find((r) => r.id === 'm1')!;
    expect(movie.isClassic).toBe(true);
    expect(movie.isNew).toBe(false);
    expect(movie.primaryTrailerKey).toBe('trailer1');
    expect(movie.poster).toEqual({ small: 'poster' });
    expect(movie.backdrop).toEqual({ small: 'backdrop' });

    const show = result.find((r) => r.id === 's1')!;
    expect(show.isNew).toBe(true);
    expect(show.isClassic).toBe(false);
    expect(show.showProgress).toMatchObject({ season: 2, episode: 3, label: 'S2E3' });
  });

  it('should skip fallback pass when strict pass fills limit', async () => {
    const now = new Date();
    const mediaRows = Array.from({ length: 3 }, (_, i) => ({
      id: `m${i}`,
      type: MediaType.MOVIE,
      slug: `movie-${i}`,
      title: `Movie ${i}`,
      originalTitle: `Movie ${i}`,
      overview: 'ov',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      releaseDate: now,
      videos: [],
      ratingoScore: 0.8,
      qualityScore: 70,
      watchersCount: 10,
      totalWatchers: 20,
      rating: 8,
      voteCount: 1000,
    }));

    setup([mediaRows]);

    const result = await query.execute({ limit: 3 });

    expect(result).toHaveLength(3);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should combine strict and fallback results', async () => {
    const now = new Date();
    const strictRows = [
      {
        id: 'm1',
        type: MediaType.MOVIE,
        slug: 'strict-movie',
        title: 'Strict Movie',
        originalTitle: 'Strict Movie',
        overview: 'ov',
        posterPath: '/p.jpg',
        backdropPath: '/b.jpg',
        releaseDate: now,
        videos: [],
        ratingoScore: 0.9,
        qualityScore: 80,
        watchersCount: 100,
        totalWatchers: 200,
        rating: 9,
        voteCount: 5000,
      },
    ];

    const fallbackRows = [
      {
        id: 'm2',
        type: MediaType.MOVIE,
        slug: 'fallback-movie',
        title: 'Fallback Movie',
        originalTitle: 'Fallback Movie',
        overview: 'ov',
        posterPath: '/p.jpg',
        backdropPath: '/b.jpg',
        releaseDate: now,
        videos: [],
        ratingoScore: 0.7,
        qualityScore: 65,
        watchersCount: 20,
        totalWatchers: 50,
        rating: 7,
        voteCount: 1000,
      },
    ];

    setup([strictRows, fallbackRows]);

    const result = await query.execute({ limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('m1');
    expect(result[1].id).toBe('m2');
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('should return empty array on error', async () => {
    setup([], new Error('DB Error'));
    const result = await query.execute({ limit: 3 });
    expect(result).toEqual([]);
  });
});
