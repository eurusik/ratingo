import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotsPipeline } from './snapshots.pipeline';
import { SnapshotsService } from '../services/snapshots.service';
import { BulkJobService } from '../services/bulk-job.service';
import { MEDIA_REPOSITORY } from '../../../catalog/public';
import { IngestionJob } from '../../ingestion.constants';

describe('SnapshotsPipeline', () => {
  let pipeline: SnapshotsPipeline;
  let snapshotsService: jest.Mocked<SnapshotsService>;
  let bulkJobService: jest.Mocked<BulkJobService>;
  let mediaRepository: any;

  beforeEach(async () => {
    const mockSnapshotsService = {
      syncSnapshotItem: jest.fn().mockResolvedValue(undefined),
    };

    const mockBulkJobService = {
      enqueueBulk: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
      enqueueBatch: jest
        .fn()
        .mockImplementation(
          (jobs, logger, context, cumulative = { found: 0, enqueued: 0, deduped: 0 }) =>
            Promise.resolve({
              found: cumulative.found + jobs.length,
              enqueued: cumulative.enqueued + jobs.length,
              deduped: cumulative.deduped,
            }),
        ),
    };

    const mockMediaRepository = {
      findIdsForSnapshots: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsPipeline,
        { provide: SnapshotsService, useValue: mockSnapshotsService },
        { provide: BulkJobService, useValue: mockBulkJobService },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
      ],
    }).compile();

    pipeline = module.get<SnapshotsPipeline>(SnapshotsPipeline);
    snapshotsService = module.get(SnapshotsService);
    bulkJobService = module.get(BulkJobService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
  });

  describe('dispatch', () => {
    it('should iterate through all media items and enqueue snapshot jobs', async () => {
      mediaRepository.findIdsForSnapshots
        .mockResolvedValueOnce(['id1', 'id2', 'id3'])
        .mockResolvedValueOnce(['id4', 'id5'])
        .mockResolvedValueOnce([]);

      await pipeline.dispatch('UA');

      expect(mediaRepository.findIdsForSnapshots).toHaveBeenCalledTimes(3);
      expect(bulkJobService.enqueueBatch).toHaveBeenCalledTimes(2);
      expect(bulkJobService.enqueueBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_SNAPSHOT_ITEM,
            data: expect.objectContaining({ mediaItemId: 'id1', region: 'UA' }),
          }),
        ]),
        expect.any(Object),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should normalize region', async () => {
      mediaRepository.findIdsForSnapshots.mockResolvedValueOnce(['id1']).mockResolvedValueOnce([]);

      await pipeline.dispatch('ua');

      expect(bulkJobService.enqueueBatch).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            data: expect.objectContaining({ region: 'UA' }),
          }),
        ],
        expect.any(Object),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should handle empty result set', async () => {
      mediaRepository.findIdsForSnapshots.mockResolvedValue([]);

      await pipeline.dispatch('UA');

      expect(bulkJobService.enqueueBatch).not.toHaveBeenCalled();
    });
  });

  describe('processItem', () => {
    it('should call snapshotsService with parsed date', async () => {
      await pipeline.processItem('media-123', '20251221', 'UA');

      expect(snapshotsService.syncSnapshotItem).toHaveBeenCalledWith(
        'media-123',
        expect.any(Date),
        'UA',
      );
    });

    it('should throw error for invalid dayId', async () => {
      await expect(pipeline.processItem('media-123', 'invalid', 'UA')).rejects.toThrow(
        /Invalid snapshot dayId/,
      );
    });
  });
});
