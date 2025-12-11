import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleShowRepository } from './drizzle-show.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { TrendingShowsQuery } from '../queries/trending-shows.query';
import { ShowDetailsQuery } from '../queries/show-details.query';
import { CalendarEpisodesQuery } from '../queries/calendar-episodes.query';

// Chainable thenable mock
const createThenable = (resolveWith: any = [], rejectWith?: Error, extraMethods: string[] = []) => {
  const thenable: any = {};
  const chainMethods = [
    'insert', 'values', 'onConflictDoUpdate', 'returning',
    'update', 'set', 'where',
    'select', 'from', 'innerJoin', 'limit',
    ...extraMethods,
  ];
  chainMethods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('DrizzleShowRepository', () => {
  let repository: DrizzleShowRepository;
  let db: any;
  let trendingQuery: any;
  let detailsQuery: any;
  let calendarQuery: any;
  let insertChain: any;
  let updateChain: any;
  let selectChain: any;

  const setup = (options: { resolveSelect?: any; reject?: Error } = {}) => {
    insertChain = createThenable([{ id: 'show-id' }], options.reject);
    updateChain = createThenable([], options.reject);
    selectChain = createThenable(options.resolveSelect ?? [], options.reject);

    db = {
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
      select: jest.fn().mockReturnValue(selectChain),
    };

    trendingQuery = { execute: jest.fn().mockResolvedValue(['trending']) };
    detailsQuery = { execute: jest.fn().mockResolvedValue('details') };
    calendarQuery = { execute: jest.fn().mockResolvedValue(['calendar']) };

    return Test.createTestingModule({
      providers: [
        DrizzleShowRepository,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: TrendingShowsQuery, useValue: trendingQuery },
        { provide: ShowDetailsQuery, useValue: detailsQuery },
        { provide: CalendarEpisodesQuery, useValue: calendarQuery },
      ],
    }).compile();
  };

  describe('upsertDetails', () => {
    it('should upsert show details, seasons, episodes', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);
      const tx = { insert: jest.fn().mockReturnValue(insertChain) } as any;

      await repository.upsertDetails(tx, 'media-1', {
        seasons: [{ number: 1, episodes: [{ number: 1 }] }],
      });

      expect(tx.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalled();
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should propagate errors', async () => {
      const errChain = createThenable([], new Error('DB Error'));
      const tx = { insert: jest.fn().mockReturnValue(errChain) } as any;
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      await expect(repository.upsertDetails(tx, 'media-1', {})).rejects.toThrow('DB Error');
    });
  });

  describe('saveDropOffAnalysis', () => {
    it('should update drop-off analysis', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      await repository.saveDropOffAnalysis(1, { chart: [] } as any);
      expect(db.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalled();
      expect(updateChain.where).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleShowRepository);

      await expect(repository.saveDropOffAnalysis(1, { chart: [] } as any)).rejects.toThrow(DatabaseException);
    });
  });

  describe('findShowsForAnalysis', () => {
    it('should return shows', async () => {
      const module: TestingModule = await setup({ resolveSelect: [{ tmdbId: 1, title: 'Show' }] });
      repository = module.get(DrizzleShowRepository);

      const res = await repository.findShowsForAnalysis(5);
      expect(res).toEqual([{ tmdbId: 1, title: 'Show' }]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleShowRepository);

      await expect(repository.findShowsForAnalysis(5)).rejects.toThrow(DatabaseException);
    });
  });

  describe('getDropOffAnalysis', () => {
    it('should return analysis when found', async () => {
      const module: TestingModule = await setup({ resolveSelect: [{ dropOffAnalysis: { chart: [] } }] });
      repository = module.get(DrizzleShowRepository);

      const res = await repository.getDropOffAnalysis(1);
      expect(res).toEqual({ chart: [] });
    });

    it('should return null when not found', async () => {
      const module: TestingModule = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleShowRepository);

      const res = await repository.getDropOffAnalysis(1);
      expect(res).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const module: TestingModule = await setup({ reject: new Error('DB Error') });
      repository = module.get(DrizzleShowRepository);

      await expect(repository.getDropOffAnalysis(1)).rejects.toThrow(DatabaseException);
    });
  });

  describe('delegating queries', () => {
    it('findBySlug delegates to showDetailsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const res = await repository.findBySlug('slug');
      expect(res).toEqual('details');
      expect(detailsQuery.execute).toHaveBeenCalledWith('slug');
    });

    it('findTrending delegates to trendingShowsQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const res = await repository.findTrending({} as any);
      expect(res).toEqual(['trending']);
      expect(trendingQuery.execute).toHaveBeenCalled();
    });

    it('findEpisodesByDateRange delegates to calendarEpisodesQuery', async () => {
      const module: TestingModule = await setup();
      repository = module.get(DrizzleShowRepository);

      const start = new Date();
      const end = new Date();
      const res = await repository.findEpisodesByDateRange(start, end);
      expect(res).toEqual(['calendar']);
      expect(calendarQuery.execute).toHaveBeenCalledWith(start, end);
    });
  });
});
