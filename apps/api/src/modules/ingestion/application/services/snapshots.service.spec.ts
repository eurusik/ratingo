import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotsService } from './snapshots.service';
import { TraktAdapter } from '../../infrastructure/adapters/trakt/trakt.adapter';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsService,
        { provide: TraktAdapter, useValue: traktAdapter },
        { provide: DATABASE_CONNECTION, useValue: db },
      ],
    }).compile();

    service = module.get<SnapshotsService>(SnapshotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncDailySnapshots', () => {
    it('should fetch active items and sync stats', async () => {
      // Mock DB fetching items
      const mockItems = [
        { id: '1', tmdbId: 101, type: MediaType.MOVIE },
        { id: '2', tmdbId: 202, type: MediaType.SHOW },
      ];
      db.where.mockResolvedValueOnce(mockItems);

      // Mock Trakt responses
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue({ totalWatchers: 500 });
      traktAdapter.getShowRatingsByTmdbId.mockResolvedValue({ totalWatchers: 1000 });

      await service.syncDailySnapshots();

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();

      // Check movie sync
      expect(traktAdapter.getMovieRatingsByTmdbId).toHaveBeenCalledWith(101);

      // Check show sync
      expect(traktAdapter.getShowRatingsByTmdbId).toHaveBeenCalledWith(202);

      // Check DB inserts
      expect(db.insert).toHaveBeenCalledTimes(2); // One per batch item
    });

    it('should handle API errors gracefully', async () => {
      const mockItems = [{ id: '1', tmdbId: 101, type: MediaType.MOVIE }];
      db.where.mockResolvedValueOnce(mockItems);

      traktAdapter.getMovieRatingsByTmdbId.mockRejectedValue(new Error('API Error'));

      await service.syncDailySnapshots();

      expect(traktAdapter.getMovieRatingsByTmdbId).toHaveBeenCalledWith(101);
      expect(db.insert).not.toHaveBeenCalled(); // Should skip insert on error
    });
  });
});
