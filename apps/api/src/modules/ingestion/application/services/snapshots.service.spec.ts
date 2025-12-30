import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotsService } from './snapshots.service';
import { TraktRatingsAdapter } from '../../infrastructure/adapters/trakt/trakt-ratings.adapter';
import { SNAPSHOTS_REPOSITORY } from '../../domain/repositories/snapshots.repository.interface';
import { MediaType } from '../../../../common/enums/media-type.enum';

describe('SnapshotsService', () => {
  let service: SnapshotsService;
  let traktAdapter: jest.Mocked<
    Pick<TraktRatingsAdapter, 'getMovieRatingsByTmdbId' | 'getShowRatingsByTmdbId'>
  >;
  let snapshotsRepository: {
    findMediaItemForSnapshot: jest.Mock;
    upsertSnapshot: jest.Mock;
  };

  beforeEach(async () => {
    traktAdapter = {
      getMovieRatingsByTmdbId: jest.fn(),
      getShowRatingsByTmdbId: jest.fn(),
    };

    snapshotsRepository = {
      findMediaItemForSnapshot: jest.fn(),
      upsertSnapshot: jest.fn(),
    };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsService,
        { provide: TraktRatingsAdapter, useValue: traktAdapter },
        { provide: SNAPSHOTS_REPOSITORY, useValue: snapshotsRepository },
      ],
    }).compile();

    service = testingModule.get<SnapshotsService>(SnapshotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncSnapshotItem', () => {
    it('should upsert snapshot for movie', async () => {
      snapshotsRepository.findMediaItemForSnapshot.mockResolvedValue({
        tmdbId: 101,
        type: MediaType.MOVIE,
      });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue({
        rating: 8.0,
        votes: 1000,
        watchers: 50,
        totalWatchers: 500,
      });

      await service.syncSnapshotItem('media-1', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(snapshotsRepository.findMediaItemForSnapshot).toHaveBeenCalledWith('media-1');
      expect(traktAdapter.getMovieRatingsByTmdbId).toHaveBeenCalledWith(101);
      expect(traktAdapter.getShowRatingsByTmdbId).not.toHaveBeenCalled();
      expect(snapshotsRepository.upsertSnapshot).toHaveBeenCalledWith({
        mediaItemId: 'media-1',
        snapshotDate: new Date('2025-01-01T00:00:00.000Z'),
        totalWatchers: 500,
        region: 'global',
      });
    });

    it('should upsert snapshot for show', async () => {
      snapshotsRepository.findMediaItemForSnapshot.mockResolvedValue({
        tmdbId: 202,
        type: MediaType.SHOW,
      });
      traktAdapter.getShowRatingsByTmdbId.mockResolvedValue({
        rating: 9.0,
        votes: 2000,
        watchers: 100,
        totalWatchers: 1000,
      });

      await service.syncSnapshotItem('media-2', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(snapshotsRepository.findMediaItemForSnapshot).toHaveBeenCalledWith('media-2');
      expect(traktAdapter.getShowRatingsByTmdbId).toHaveBeenCalledWith(202);
      expect(traktAdapter.getMovieRatingsByTmdbId).not.toHaveBeenCalled();
      expect(snapshotsRepository.upsertSnapshot).toHaveBeenCalledWith({
        mediaItemId: 'media-2',
        snapshotDate: new Date('2025-01-01T00:00:00.000Z'),
        totalWatchers: 1000,
        region: 'global',
      });
    });

    it('should skip when media item is not found', async () => {
      snapshotsRepository.findMediaItemForSnapshot.mockResolvedValue(null);

      await service.syncSnapshotItem('missing', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(traktAdapter.getMovieRatingsByTmdbId).not.toHaveBeenCalled();
      expect(traktAdapter.getShowRatingsByTmdbId).not.toHaveBeenCalled();
      expect(snapshotsRepository.upsertSnapshot).not.toHaveBeenCalled();
    });

    it('should skip upsert when Trakt returns null', async () => {
      snapshotsRepository.findMediaItemForSnapshot.mockResolvedValue({
        tmdbId: 101,
        type: MediaType.MOVIE,
      });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);

      await service.syncSnapshotItem('media-1', new Date('2025-01-01T00:00:00.000Z'), 'global');

      expect(snapshotsRepository.upsertSnapshot).not.toHaveBeenCalled();
    });

    it('should rethrow API errors (so worker can retry)', async () => {
      snapshotsRepository.findMediaItemForSnapshot.mockResolvedValue({
        tmdbId: 101,
        type: MediaType.MOVIE,
      });
      traktAdapter.getMovieRatingsByTmdbId.mockRejectedValue(new Error('API Error'));

      await expect(
        service.syncSnapshotItem('media-1', new Date('2025-01-01T00:00:00.000Z'), 'global'),
      ).rejects.toThrow('API Error');

      expect(snapshotsRepository.upsertSnapshot).not.toHaveBeenCalled();
    });
  });
});
