import { ShowDetailsQuery } from './show-details.query';
import { CreditsMapper } from '../mappers/credits.mapper';
import { ImageMapper } from '../mappers/image.mapper';
import { WatchProvidersMapper } from '../mappers/watch-providers.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

// Chainable thenable for Drizzle-like API
const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit'];
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

describe('ShowDetailsQuery', () => {
  let query: ShowDetailsQuery;
  let db: any;
  let selectQueue: any[];

  beforeEach(() => {
    jest.spyOn(CreditsMapper, 'toDto').mockReturnValue({ cast: [] } as any);
    jest.spyOn(ImageMapper, 'toPoster').mockReturnValue({ small: 'poster' } as any);
    jest.spyOn(ImageMapper, 'toBackdrop').mockReturnValue({ small: 'backdrop' } as any);
    jest.spyOn(WatchProvidersMapper, 'toAvailability').mockReturnValue({ region: 'UA' } as any);
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

    query = new ShowDetailsQuery(db as any);
  };

  it('should map show details with genres and seasons', async () => {
    const showRow = {
      id: 'm1',
      tmdbId: 201,
      title: 'Show',
      originalTitle: 'Orig',
      slug: 'show',
      overview: 'overview',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      ingestionStatus: 'done',
      videos: [{ key: 'trailer1' }],
      credits: {},
      watchProviders: {},
      totalSeasons: 2,
      totalEpisodes: 20,
      status: 'Ended',
      lastAirDate: new Date('2024-01-01'),
      nextAirDate: new Date('2025-01-01'),
      rating: 9,
      voteCount: 100,
      ratingImdb: 8,
      voteCountImdb: 900,
      ratingTrakt: 8,
      voteCountTrakt: 800,
      ratingMetacritic: 75,
      ratingRottenTomatoes: 85,
      ratingoScore: 0.9,
      qualityScore: 0.8,
      popularityScore: 0.95,
      watchersCount: 5,
      totalWatchers: 10,
      showId: 'sh1',
    } as any;

    const genres = [
      { id: 'g1', name: 'Action', slug: 'action' },
      { id: 'g2', name: 'Drama', slug: 'drama' },
    ];

    const seasons = [
      { number: 1, name: 'S1', episodeCount: 10, posterPath: '/s1.jpg', airDate: new Date('2023-01-01') },
      { number: 2, name: 'S2', episodeCount: 10, posterPath: '/s2.jpg', airDate: new Date('2024-01-01') },
    ];

    setup([[showRow], genres, seasons]);

    const res = await query.execute('show');

    expect(db.select).toHaveBeenCalledTimes(3); // main + genres + seasons
    expect(res?.id).toBe('m1');
    expect(res?.primaryTrailer).toEqual({ key: 'trailer1' });
    expect(res?.poster).toEqual({ small: 'poster' });
    expect(res?.backdrop).toEqual({ small: 'backdrop' });
    expect(res?.genres).toHaveLength(2);
    expect(res?.seasons).toHaveLength(2);
    expect(CreditsMapper.toDto).toHaveBeenCalled();
    expect(WatchProvidersMapper.toAvailability).toHaveBeenCalled();
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
