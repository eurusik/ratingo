import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotsPipeline } from './snapshots.pipeline';
import { SnapshotsService, SnapshotBatchResult } from '../services/snapshots.service';
import { MEDIA_REPOSITORY, SnapshotCandidate } from '../../../catalog/public';
import { MediaType } from '../../../../common/enums/media-type.enum';

describe('SnapshotsPipeline', () => {
  let pipeline: SnapshotsPipeline;
  let snapshotsService: jest.Mocked<SnapshotsService>;
  let mediaRepository: {
    findSnapshotCandidates: jest.Mock;
  };

  beforeEach(async () => {
    const mockSnapshotsService = {
      syncSnapshotItem: jest.fn().mockResolvedValue(undefined),
      syncSnapshotBatch: jest
        .fn()
        .mockResolvedValue({ synced: 0, skipped: 0, errors: 0 } as SnapshotBatchResult),
    };

    const mockMediaRepository = {
      findSnapshotCandidates: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsPipeline,
        { provide: SnapshotsService, useValue: mockSnapshotsService },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
      ],
    }).compile();

    pipeline = module.get<SnapshotsPipeline>(SnapshotsPipeline);
    snapshotsService = module.get(SnapshotsService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
  });

  describe('dispatch', () => {
    it('should iterate through all ELIGIBLE media items and sync snapshots in batches', async () => {
      const batch1: SnapshotCandidate[] = [
        { id: 'id1', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'id2', tmdbId: 102, type: MediaType.SHOW },
        { id: 'id3', tmdbId: 103, type: MediaType.MOVIE },
      ];
      const batch2: SnapshotCandidate[] = [
        { id: 'id4', tmdbId: 104, type: MediaType.SHOW },
        { id: 'id5', tmdbId: 105, type: MediaType.MOVIE },
      ];

      mediaRepository.findSnapshotCandidates
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      snapshotsService.syncSnapshotBatch
        .mockResolvedValueOnce({ synced: 3, skipped: 0, errors: 0 })
        .mockResolvedValueOnce({ synced: 2, skipped: 0, errors: 0 });

      await pipeline.dispatch('UA');

      expect(mediaRepository.findSnapshotCandidates).toHaveBeenCalledTimes(3);
      expect(mediaRepository.findSnapshotCandidates).toHaveBeenNthCalledWith(1, {
        limit: 500,
        cursor: undefined,
      });
      expect(mediaRepository.findSnapshotCandidates).toHaveBeenNthCalledWith(2, {
        limit: 500,
        cursor: 'id3',
      });
      expect(mediaRepository.findSnapshotCandidates).toHaveBeenNthCalledWith(3, {
        limit: 500,
        cursor: 'id5',
      });

      expect(snapshotsService.syncSnapshotBatch).toHaveBeenCalledTimes(2);
      expect(snapshotsService.syncSnapshotBatch).toHaveBeenNthCalledWith(
        1,
        batch1,
        expect.any(Date),
        'UA',
      );
      expect(snapshotsService.syncSnapshotBatch).toHaveBeenNthCalledWith(
        2,
        batch2,
        expect.any(Date),
        'UA',
      );
    });

    it('should normalize region', async () => {
      const batch: SnapshotCandidate[] = [{ id: 'id1', tmdbId: 101, type: MediaType.MOVIE }];
      mediaRepository.findSnapshotCandidates.mockResolvedValueOnce(batch).mockResolvedValueOnce([]);
      snapshotsService.syncSnapshotBatch.mockResolvedValue({ synced: 1, skipped: 0, errors: 0 });

      await pipeline.dispatch('ua');

      expect(snapshotsService.syncSnapshotBatch).toHaveBeenCalledWith(
        batch,
        expect.any(Date),
        'UA',
      );
    });

    it('should use global region by default', async () => {
      const batch: SnapshotCandidate[] = [{ id: 'id1', tmdbId: 101, type: MediaType.MOVIE }];
      mediaRepository.findSnapshotCandidates.mockResolvedValueOnce(batch).mockResolvedValueOnce([]);
      snapshotsService.syncSnapshotBatch.mockResolvedValue({ synced: 1, skipped: 0, errors: 0 });

      await pipeline.dispatch();

      expect(snapshotsService.syncSnapshotBatch).toHaveBeenCalledWith(
        batch,
        expect.any(Date),
        'global',
      );
    });

    it('should handle empty result set', async () => {
      mediaRepository.findSnapshotCandidates.mockResolvedValue([]);

      await pipeline.dispatch('UA');

      expect(snapshotsService.syncSnapshotBatch).not.toHaveBeenCalled();
    });

    it('should accumulate results from all batches', async () => {
      const batch1: SnapshotCandidate[] = [
        { id: 'id1', tmdbId: 101, type: MediaType.MOVIE },
        { id: 'id2', tmdbId: 102, type: MediaType.SHOW },
      ];
      const batch2: SnapshotCandidate[] = [{ id: 'id3', tmdbId: 103, type: MediaType.MOVIE }];

      mediaRepository.findSnapshotCandidates
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      snapshotsService.syncSnapshotBatch
        .mockResolvedValueOnce({ synced: 1, skipped: 1, errors: 0 })
        .mockResolvedValueOnce({ synced: 0, skipped: 0, errors: 1 });

      // Should complete without error - results are logged
      await pipeline.dispatch('UA');

      expect(snapshotsService.syncSnapshotBatch).toHaveBeenCalledTimes(2);
    });
  });
});
