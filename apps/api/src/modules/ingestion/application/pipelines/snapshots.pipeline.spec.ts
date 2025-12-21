import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { SnapshotsPipeline } from './snapshots.pipeline';
import { SnapshotsService } from '../services/snapshots.service';
import { MEDIA_REPOSITORY } from '../../../catalog/domain/repositories/media.repository.interface';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';

describe('SnapshotsPipeline', () => {
  let pipeline: SnapshotsPipeline;
  let snapshotsService: any;
  let mediaRepository: any;
  let ingestionQueue: any;

  beforeEach(async () => {
    snapshotsService = {
      syncSnapshotItem: jest.fn().mockResolvedValue(undefined),
    };

    mediaRepository = {
      findIdsForSnapshots: jest.fn().mockResolvedValue([]),
    };

    ingestionQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      addBulk: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotsPipeline,
        { provide: SnapshotsService, useValue: snapshotsService },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
      ],
    }).compile();

    pipeline = module.get<SnapshotsPipeline>(SnapshotsPipeline);
  });

  describe('dispatch', () => {
    it('should iterate through all media items and enqueue snapshot jobs', async () => {
      mediaRepository.findIdsForSnapshots
        .mockResolvedValueOnce(['id1', 'id2', 'id3'])
        .mockResolvedValueOnce(['id4', 'id5'])
        .mockResolvedValueOnce([]);

      await pipeline.dispatch('UA');

      expect(mediaRepository.findIdsForSnapshots).toHaveBeenCalledTimes(3);
      expect(ingestionQueue.addBulk).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_SNAPSHOT_ITEM,
            data: expect.objectContaining({ mediaItemId: 'id1', region: 'UA' }),
          }),
        ]),
      );
    });

    it('should deduplicate existing jobs', async () => {
      mediaRepository.findIdsForSnapshots
        .mockResolvedValueOnce(['id1', 'id2'])
        .mockResolvedValueOnce([]);
      ingestionQueue.getJob.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);

      await pipeline.dispatch('UA');

      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          data: expect.objectContaining({ mediaItemId: 'id2' }),
        }),
      ]);
    });

    it('should normalize region', async () => {
      mediaRepository.findIdsForSnapshots.mockResolvedValueOnce(['id1']).mockResolvedValueOnce([]);

      await pipeline.dispatch('ua');

      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          data: expect.objectContaining({ region: 'UA' }),
        }),
      ]);
    });

    it('should handle empty result set', async () => {
      mediaRepository.findIdsForSnapshots.mockResolvedValue([]);

      await pipeline.dispatch('UA');

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
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
        /Invalid snapshot dayId payload/,
      );
    });
  });
});
