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
    bulkUpsertSnapshots: jest.Mock;
  };

  beforeEach(async () => {
    traktAdapter = {
      getMovieRatingsByTmdbId: jest.fn(),
      getShowRatingsByTmdbId: jest.fn(),
      getTotalWatchersByTmdbIds: jest.fn(),
    };

    snapshotsRepository = {
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
