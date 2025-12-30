import { NewEpisodesQuery } from './new-episodes.query';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

// Chainable thenable for Drizzle-like API
const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'innerJoin', 'where', 'orderBy', 'limit'];
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

describe('NewEpisodesQuery', () => {
  let query: NewEpisodesQuery;
  let db: any;

  const setup = (resolveWith: any[] = [], rejectWith?: Error) => {
    db = {
      select: jest.fn().mockReturnValue(createThenable(resolveWith, rejectWith)),
    };
    query = new NewEpisodesQuery(db as any);
  };

  it('should return new episodes grouped by show', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const episodes = [
      {
        showId: 'show1',
        slug: 'breaking-bad',
        title: 'Breaking Bad',
        posterPath: '/bb.jpg',
        seasonNumber: 5,
        episodeNumber: 16,
        episodeTitle: 'Felina',
        airDate: now,
      },
      {
        showId: 'show1',
        slug: 'breaking-bad',
        title: 'Breaking Bad',
        posterPath: '/bb.jpg',
        seasonNumber: 5,
        episodeNumber: 15,
        episodeTitle: 'Granite State',
        airDate: yesterday,
      },
      {
        showId: 'show2',
        slug: 'better-call-saul',
        title: 'Better Call Saul',
        posterPath: '/bcs.jpg',
        seasonNumber: 6,
        episodeNumber: 13,
        episodeTitle: 'Saul Gone',
        airDate: yesterday,
      },
    ];

    setup(episodes);

    const result = await query.execute(7, 10);

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);

    // First show - latest episode only
    expect(result[0].showId).toBe('show1');
    expect(result[0].episodeNumber).toBe(16);
    expect(result[0].episodeTitle).toBe('Felina');

    // Second show
    expect(result[1].showId).toBe('show2');
    expect(result[1].episodeNumber).toBe(13);
  });

  it('should respect limit parameter', async () => {
    const episodes = [
      {
        showId: 'show1',
        slug: 's1',
        title: 'Show 1',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: new Date(),
      },
      {
        showId: 'show2',
        slug: 's2',
        title: 'Show 2',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: new Date(),
      },
      {
        showId: 'show3',
        slug: 's3',
        title: 'Show 3',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: new Date(),
      },
    ];

    setup(episodes);

    const result = await query.execute(7, 2);

    expect(result).toHaveLength(2);
    expect(result[0].showId).toBe('show1');
    expect(result[1].showId).toBe('show2');
  });

  it('should return empty array when no episodes found', async () => {
    setup([]);

    const result = await query.execute(7, 20);

    expect(result).toEqual([]);
  });

  it('should skip episodes without airDate', async () => {
    const episodes = [
      {
        showId: 'show1',
        slug: 's1',
        title: 'Show 1',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: null,
      },
      {
        showId: 'show2',
        slug: 's2',
        title: 'Show 2',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: new Date(),
      },
    ];

    setup(episodes);

    const result = await query.execute(7, 20);

    expect(result).toHaveLength(1);
    expect(result[0].showId).toBe('show2');
  });

  it('should use default values when not provided', async () => {
    setup([]);

    await query.execute();

    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should throw DatabaseException on error', async () => {
    setup([], new Error('DB Error'));

    await expect(query.execute()).rejects.toThrow(DatabaseException);
  });

  it('should handle null episodeTitle gracefully', async () => {
    const episodes = [
      {
        showId: 'show1',
        slug: 's1',
        title: 'Show 1',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: null,
        airDate: new Date(),
      },
    ];

    setup(episodes);

    const result = await query.execute();

    expect(result[0].episodeTitle).toBe('');
  });
});
