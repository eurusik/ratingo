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

    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
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
      db.where.mockResolvedValueOnce([{ tmdbId: 101, type: MediaType.MOVIE }]);
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue({ totalWatchers: 500 });

      await service.syncSnapshotItem('media-1', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(traktAdapter.getMovieRatingsByTmdbId).toHaveBeenCalledWith(101);
      expect(traktAdapter.getShowRatingsByTmdbId).not.toHaveBeenCalled();

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaItemId: 'media-1',
          totalWatchers: 500,
          region: 'global',
        }),
      );
    });

    it('should upsert snapshot for show', async () => {
      db.where.mockResolvedValueOnce([{ tmdbId: 202, type: MediaType.SHOW }]);
      traktAdapter.getShowRatingsByTmdbId.mockResolvedValue({ totalWatchers: 1000 });

      await service.syncSnapshotItem('media-2', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(traktAdapter.getShowRatingsByTmdbId).toHaveBeenCalledWith(202);
      expect(traktAdapter.getMovieRatingsByTmdbId).not.toHaveBeenCalled();

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaItemId: 'media-2',
          totalWatchers: 1000,
          region: 'global',
        }),
      );
    });

    it('should skip when media item is not found', async () => {
      db.where.mockResolvedValueOnce([]);

      await service.syncSnapshotItem('missing', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(traktAdapter.getMovieRatingsByTmdbId).not.toHaveBeenCalled();
      expect(traktAdapter.getShowRatingsByTmdbId).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should rethrow API errors (so worker can retry)', async () => {
      db.where.mockResolvedValueOnce([{ tmdbId: 101, type: MediaType.MOVIE }]);
      traktAdapter.getMovieRatingsByTmdbId.mockRejectedValue(new Error('API Error'));

      await expect(
        service.syncSnapshotItem('media-1', new Date('2025-01-01T00:00:00.000Z'), 'global'),
      ).rejects.toThrow('API Error');

      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
