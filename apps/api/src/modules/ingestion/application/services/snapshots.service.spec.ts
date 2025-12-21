import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotsService } from './snapshots.service';
import { TraktRatingsAdapter } from '../../infrastructure/adapters/trakt/trakt-ratings.adapter';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { MediaType } from '../../../../common/enums/media-type.enum';

describe('SnapshotsService', () => {
  let service: SnapshotsService;
  let traktAdapter: any;
  let db: any;

  beforeEach(async () => {
    traktAdapter = {
      getMovieRatingsByTmdbId: jest.fn(),
      getShowRatingsByTmdbId: jest.fn(),
    };

    const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
      const thenable: any = {};
      const chainMethods = [
        'select',
        'from',
        'where',
        'limit',
        'insert',
        'values',
        'onConflictDoUpdate',
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

    const selectChain = createThenable();
    const insertChain = createThenable(undefined);

    db = {
      select: jest.fn().mockReturnValue(selectChain),
      insert: jest.fn().mockReturnValue(insertChain),
    };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsService,
        { provide: TraktRatingsAdapter, useValue: traktAdapter },
        { provide: DATABASE_CONNECTION, useValue: db },
      ],
    }).compile();

    service = testingModule.get<SnapshotsService>(SnapshotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncSnapshotItem', () => {
    it('should upsert snapshot for movie', async () => {
      (db.select() as any).then = (res: any) =>
        Promise.resolve([{ tmdbId: 101, type: MediaType.MOVIE }]).then(res);
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue({ totalWatchers: 500 });

      await service.syncSnapshotItem('media-1', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(traktAdapter.getMovieRatingsByTmdbId).toHaveBeenCalledWith(101);
      expect(traktAdapter.getShowRatingsByTmdbId).not.toHaveBeenCalled();

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect((db.insert() as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaItemId: 'media-1',
          totalWatchers: 500,
          region: 'global',
        }),
      );
    });

    it('should upsert snapshot for show', async () => {
      (db.select() as any).then = (res: any) =>
        Promise.resolve([{ tmdbId: 202, type: MediaType.SHOW }]).then(res);
      traktAdapter.getShowRatingsByTmdbId.mockResolvedValue({ totalWatchers: 1000 });

      await service.syncSnapshotItem('media-2', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(traktAdapter.getShowRatingsByTmdbId).toHaveBeenCalledWith(202);
      expect(traktAdapter.getMovieRatingsByTmdbId).not.toHaveBeenCalled();

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect((db.insert() as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaItemId: 'media-2',
          totalWatchers: 1000,
          region: 'global',
        }),
      );
    });

    it('should skip when media item is not found', async () => {
      (db.select() as any).then = (res: any) => Promise.resolve([]).then(res);

      await service.syncSnapshotItem('missing', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(traktAdapter.getMovieRatingsByTmdbId).not.toHaveBeenCalled();
      expect(traktAdapter.getShowRatingsByTmdbId).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should rethrow API errors (so worker can retry)', async () => {
      (db.select() as any).then = (res: any) =>
        Promise.resolve([{ tmdbId: 101, type: MediaType.MOVIE }]).then(res);
      traktAdapter.getMovieRatingsByTmdbId.mockRejectedValue(new Error('API Error'));

      await expect(
        service.syncSnapshotItem('media-1', new Date('2025-01-01T00:00:00.000Z'), 'global'),
      ).rejects.toThrow('API Error');

      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
