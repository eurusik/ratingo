import { CalendarEpisodesQuery } from './calendar-episodes.query';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

// Chainable thenable for Drizzle-like API
const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const methods = ['select', 'from', 'innerJoin', 'where', 'orderBy'];
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

describe('CalendarEpisodesQuery', () => {
  let db: any;
  let selectQueue: any[];
  let query: CalendarEpisodesQuery;

  const setup = (selections: any[][], reject?: Error) => {
    selectQueue = [...selections];
    db = {
      select: jest.fn().mockImplementation(() => {
        const data = selectQueue.shift() ?? [];
        return createThenable(data, reject);
      }),
    };

    query = new CalendarEpisodesQuery(db as any);
  };

  it('should map episodes within date range', async () => {
    const airDate = new Date('2024-05-10');
    const episodes = [
      {
        showId: 's1',
        showTitle: 'Show',
        posterPath: '/p.jpg',
        seasonNumber: 2,
        episodeNumber: 5,
        title: 'Ep',
        overview: 'ov',
        airDate,
        runtime: 45,
        stillPath: '/still.jpg',
      },
    ];

    setup([episodes]);

    const res = await query.execute(new Date('2024-05-01'), new Date('2024-05-31'));

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(res).toEqual([
      {
        showId: 's1',
        showTitle: 'Show',
        posterPath: '/p.jpg',
        seasonNumber: 2,
        episodeNumber: 5,
        title: 'Ep',
        overview: 'ov',
        airDate,
        runtime: 45,
        stillPath: '/still.jpg',
      },
    ]);
  });

  it('should return empty array when no episodes', async () => {
    setup([[]]);
    const res = await query.execute(new Date(), new Date());
    expect(res).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('should throw DatabaseException on error', async () => {
    setup([], new Error('DB error'));
    await expect(query.execute(new Date(), new Date())).rejects.toThrow(DatabaseException);
  });
});
