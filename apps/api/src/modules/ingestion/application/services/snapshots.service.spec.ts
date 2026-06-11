import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotsService } from './snapshots.service';
import { TRAKT_RATINGS_PORT, type TraktRatingsPort } from '../../../trakt/public';
import { SNAPSHOTS_REPOSITORY } from '../../domain/repositories/snapshots.repository.interface';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { type SnapshotCandidate } from '../../../catalog/public';
import { TRAKT_MEDIA_TYPE } from '../../../trakt/public';

describe('SnapshotsService', () => {
  let service: SnapshotsService;
  let traktAdapter: jest.Mocked<
    Pick<
      TraktRatingsPort,
      'getMovieRatingsByTmdbId' | 'getShowRatingsByTmdbId' | 'getTotalWatchersByTmdbIds'
    >
  >;
  let snapshotsRepository: {
    findMediaItemForSnapshot: jest.Mock;
    upsertSnapshot: jest.Mock;
    bulkUpsertSnapshots: jest.Mock;
  };

  beforeEach(async () => {
    traktAdapter = {
      getMovieRatingsByTmdbId: jest.fn(),
      getShowRatingsByTmdbId: jest.fn(),
      getTotalWatchersByTmdbIds: jest.fn(),
    };

    snapshotsRepository = {
      findMediaItemForSnapshot: jest.fn(),
      upsertSnapshot: jest.fn(),
      bulkUpsertSnapshots: jest.fn(),
    };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsService,
        { provide: TRAKT_RATINGS_PORT, useValue: traktAdapter },
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

  describe('syncSnapshotBatch', () => {
    const snapshotDate = new Date('2025-01-01T00:00:00.000Z');

    it('should return empty result for empty candidates', async () => {
      const result = await service.syncSnapshotBatch([], snapshotDate, 'global');

      expect(result).toEqual({ synced: 0, skipped: 0, errors: 0 });
      expect(traktAdapter.getTotalWatchersByTmdbIds).not.toHaveBeenCalled();
      expect(snapshotsRepository.bulkUpsertSnapshots).not.toHaveBeenCalled();
    });

    it('should fetch total watchers for movies and shows separately', async () => {
      const candidates: SnapshotCandidate[] = [
        { id: 'id1', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'id2', tmdbId: 102, type: MediaType.SHOW },
        { id: 'id3', tmdbId: 103, type: MediaType.MOVIE },
      ];

      const movieWatchers = new Map<number, number | null | undefined>([
        [101, 500],
        [103, 300],
      ]);
      const showWatchers = new Map<number, number | null | undefined>([[102, 1000]]);

      traktAdapter.getTotalWatchersByTmdbIds
        .mockResolvedValueOnce(movieWatchers)
        .mockResolvedValueOnce(showWatchers);

      const result = await service.syncSnapshotBatch(candidates, snapshotDate, 'global');

      expect(traktAdapter.getTotalWatchersByTmdbIds).toHaveBeenCalledWith(
        TRAKT_MEDIA_TYPE.MOVIE,
        [101, 103],
      );
      expect(traktAdapter.getTotalWatchersByTmdbIds).toHaveBeenCalledWith(TRAKT_MEDIA_TYPE.SHOW, [
        102,
      ]);

      expect(snapshotsRepository.bulkUpsertSnapshots).toHaveBeenCalledWith([
        { mediaItemId: 'id1', snapshotDate, totalWatchers: 500, region: 'global' },
        { mediaItemId: 'id2', snapshotDate, totalWatchers: 1000, region: 'global' },
        { mediaItemId: 'id3', snapshotDate, totalWatchers: 300, region: 'global' },
      ]);

      expect(result).toEqual({ synced: 3, skipped: 0, errors: 0 });
    });

    it('should handle items not found in Trakt (undefined)', async () => {
      const candidates: SnapshotCandidate[] = [
        { id: 'id1', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'id2', tmdbId: 102, type: MediaType.MOVIE },
      ];

      const movieWatchers = new Map<number, number | null | undefined>([
        [101, 500],
        [102, undefined], // Not found in Trakt
      ]);

      traktAdapter.getTotalWatchersByTmdbIds.mockResolvedValue(movieWatchers);

      const result = await service.syncSnapshotBatch(candidates, snapshotDate, 'global');

      expect(snapshotsRepository.bulkUpsertSnapshots).toHaveBeenCalledWith([
        { mediaItemId: 'id1', snapshotDate, totalWatchers: 500, region: 'global' },
      ]);

      expect(result).toEqual({ synced: 1, skipped: 1, errors: 0 });
    });

    it('should handle transient errors (null)', async () => {
      const candidates: SnapshotCandidate[] = [
        { id: 'id1', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'id2', tmdbId: 102, type: MediaType.MOVIE },
      ];

      const movieWatchers = new Map<number, number | null | undefined>([
        [101, 500],
        [102, null], // Transient error
      ]);

      traktAdapter.getTotalWatchersByTmdbIds.mockResolvedValue(movieWatchers);

      const result = await service.syncSnapshotBatch(candidates, snapshotDate, 'global');

      expect(snapshotsRepository.bulkUpsertSnapshots).toHaveBeenCalledWith([
        { mediaItemId: 'id1', snapshotDate, totalWatchers: 500, region: 'global' },
      ]);

      expect(result).toEqual({ synced: 1, skipped: 0, errors: 1 });
    });

    it('should handle zero watchers correctly', async () => {
      const candidates: SnapshotCandidate[] = [{ id: 'id1', tmdbId: 101, type: MediaType.MOVIE }];

      const movieWatchers = new Map<number, number | null | undefined>([[101, 0]]);

      traktAdapter.getTotalWatchersByTmdbIds.mockResolvedValue(movieWatchers);

      const result = await service.syncSnapshotBatch(candidates, snapshotDate, 'global');

      expect(snapshotsRepository.bulkUpsertSnapshots).toHaveBeenCalledWith([
        { mediaItemId: 'id1', snapshotDate, totalWatchers: 0, region: 'global' },
      ]);

      expect(result).toEqual({ synced: 1, skipped: 0, errors: 0 });
    });

    it('should not call bulkUpsertSnapshots when no items synced', async () => {
      const candidates: SnapshotCandidate[] = [{ id: 'id1', tmdbId: 101, type: MediaType.MOVIE }];

      const movieWatchers = new Map<number, number | null | undefined>([[101, undefined]]);

      traktAdapter.getTotalWatchersByTmdbIds.mockResolvedValue(movieWatchers);

      const result = await service.syncSnapshotBatch(candidates, snapshotDate, 'global');

      expect(snapshotsRepository.bulkUpsertSnapshots).not.toHaveBeenCalled();
      expect(result).toEqual({ synced: 0, skipped: 1, errors: 0 });
    });

    it('should handle movies-only batch', async () => {
      const candidates: SnapshotCandidate[] = [
        { id: 'id1', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'id2', tmdbId: 102, type: MediaType.MOVIE },
      ];

      const movieWatchers = new Map<number, number | null | undefined>([
        [101, 500],
        [102, 300],
      ]);

      traktAdapter.getTotalWatchersByTmdbIds.mockResolvedValue(movieWatchers);

      await service.syncSnapshotBatch(candidates, snapshotDate, 'global');

      expect(traktAdapter.getTotalWatchersByTmdbIds).toHaveBeenCalledTimes(1);
      expect(traktAdapter.getTotalWatchersByTmdbIds).toHaveBeenCalledWith(
        TRAKT_MEDIA_TYPE.MOVIE,
        [101, 102],
      );
    });

    it('should handle shows-only batch', async () => {
      const candidates: SnapshotCandidate[] = [
        { id: 'id1', tmdbId: 201, type: MediaType.SHOW },
        { id: 'id2', tmdbId: 202, type: MediaType.SHOW },
      ];

      const showWatchers = new Map<number, number | null | undefined>([
        [201, 1000],
        [202, 800],
      ]);

      traktAdapter.getTotalWatchersByTmdbIds.mockResolvedValue(showWatchers);

      await service.syncSnapshotBatch(candidates, snapshotDate, 'global');

      expect(traktAdapter.getTotalWatchersByTmdbIds).toHaveBeenCalledTimes(1);
      expect(traktAdapter.getTotalWatchersByTmdbIds).toHaveBeenCalledWith(
        TRAKT_MEDIA_TYPE.SHOW,
        [201, 202],
      );
    });
  });
});
