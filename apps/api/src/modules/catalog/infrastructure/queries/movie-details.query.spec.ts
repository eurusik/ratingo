import { MovieDetailsQuery } from './movie-details.query';
import { CreditsMapper } from '../mappers/credits.mapper';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { MediaWatchOffersMapper } from '../mappers/media-watch-offers.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('MovieDetailsQuery', () => {
  let query: MovieDetailsQuery;
  let db: any;
  let selectQueue: any[];

  beforeEach(() => {
    jest.spyOn(CreditsMapper, 'toDto').mockReturnValue({ cast: [] } as any);
    jest.spyOn(ImageMapper, 'toPoster').mockReturnValue({ small: 'poster' } as any);
    jest.spyOn(ImageMapper, 'toBackdrop').mockReturnValue({ small: 'backdrop' } as any);
    jest.spyOn(MediaWatchOffersMapper, 'toAvailability').mockReturnValue({ region: 'UA' } as any);
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

    const mockGenreQuery = {
      fetchForMediaItem: jest.fn().mockImplementation(() => {
        const genresData = selectQueue.shift() ?? [];
        return Promise.resolve(genresData);
      }),
    };

    const mockWatchOffersQuery = {
      fetchForMediaItem: jest.fn().mockImplementation(() => {
        const offersData = selectQueue.shift() ?? [];
        return Promise.resolve(offersData);
      }),
    };

    query = new MovieDetailsQuery(db as any, mockGenreQuery as any, mockWatchOffersQuery as any);
  };

  // Simple thenable chain for select/from/where/innerJoin/leftJoin/limit
  const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
    const thenable: any = {};
    const methods = ['select', 'from', 'innerJoin', 'leftJoin', 'where', 'limit'];
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

  it('should return mapped movie details with genres', async () => {
    const movieRow = {
      id: 'm1',
      tmdbId: 101,
      title: 'Title',
      originalTitle: 'Orig',
      slug: 'title',
      overview: 'overview',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      ingestionStatus: 'done',
      releaseDate: new Date('2020-01-01'),
      videos: [{ key: 'trailer1' }],
      credits: {},
      watchProviders: {},
      runtime: 120,
      budget: 1000,
      revenue: 5000,
      status: 'Released',
      rating: 8,
      voteCount: 1000,
      ratingImdb: 7,
      voteCountImdb: 900,
      ratingTrakt: 8,
      voteCountTrakt: 800,
      ratingMetacritic: 75,
      ratingRottenTomatoes: 85,
      ratingoScore: 0.8,
      qualityScore: 0.7,
      popularityScore: 0.9,
      watchersCount: 10,
      totalWatchers: 20,
      theatricalReleaseDate: new Date('2020-02-01'),
      digitalReleaseDate: new Date('2020-03-01'),
    } as any;

    const genresRows = [
      { id: 'g1', name: 'Action', slug: 'action' },
      { id: 'g2', name: 'Drama', slug: 'drama' },
    ];

    const watchOffersRows: any[] = []; // Empty watch offers for test

    setup([[movieRow], genresRows, watchOffersRows]);

    const res = await query.execute('title');

    expect(res).toBeTruthy();
    expect(db.select).toHaveBeenCalledTimes(1); // main select only (genres + watch offers via mocks)
    expect(res?.id).toBe('m1');
    expect(res?.primaryTrailer).toEqual({ key: 'trailer1' });
    expect(res?.poster).toEqual({ small: 'poster' });
    expect(res?.backdrop).toEqual({ small: 'backdrop' });
    expect(res?.availability).toEqual({ region: 'UA' });
    expect(res?.genres).toHaveLength(2);
    expect(res?.releaseDate).toEqual(new Date('2020-01-01'));
    expect(res?.theatricalReleaseDate).toEqual(new Date('2020-02-01'));
    expect(res?.digitalReleaseDate).toEqual(new Date('2020-03-01'));
    expect(CreditsMapper.toDto).toHaveBeenCalled();
    expect(MediaWatchOffersMapper.toAvailability).toHaveBeenCalled();
  });

  it('should return null when not found', async () => {
    setup([[]]);
    const res = await query.execute('missing');
    expect(res).toBeNull();
  });

  it('should throw DatabaseException on error', async () => {
    setup([], new Error('DB Error'));
    await expect(query.execute('slug')).rejects.toThrow(DatabaseException);
  });
});
