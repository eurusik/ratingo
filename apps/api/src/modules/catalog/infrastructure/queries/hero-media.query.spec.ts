import { HeroMediaQuery } from './hero-media.query';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageMapper } from '../mappers/image.mapper';

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
    // First select: base media results (one movie, one show)
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

    // Second select: shows data
    const showsData = [
      {
        mediaItemId: 's1',
        showId: 'sh1',
        lastAirDate: new Date('2024-01-01'),
        nextAirDate: new Date('2025-01-01'),
      },
    ];

    // Third select: episodes data (latest first)
    const episodes = [
      {
        showId: 'sh1',
        seasonNum: 2,
        episodeNumber: 3,
        airDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    setup([mediaRows, showsData, episodes]);

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

  it('should return empty array on error', async () => {
    setup([], new Error('DB Error'));
    const result = await query.execute({ limit: 3 });
    expect(result).toEqual([]);
  });
});
