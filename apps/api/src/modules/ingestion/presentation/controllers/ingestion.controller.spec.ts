import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from './ingestion.controller';
import { SyncMediaService } from '../../application/services/sync-media.service';
import { getQueueToken } from '@nestjs/bullmq';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { MediaType } from '../../../../common/enums/media-type.enum';

describe('IngestionController', () => {
  let controller: IngestionController;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const mockSyncService = {}; // Not used directly in controller methods we test

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        { provide: getQueueToken(INGESTION_QUEUE), useValue: mockQueue },
        { provide: SyncMediaService, useValue: mockSyncService },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
  });

  describe('sync', () => {
    it('should queue movie sync job', async () => {
      const dto = { tmdbId: 550, type: MediaType.MOVIE };
      await controller.sync(dto);

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_MOVIE, { tmdbId: 550 });
    });

    it('should queue show sync job', async () => {
      const dto = { tmdbId: 100, type: MediaType.SHOW };
      await controller.sync(dto);

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_SHOW, { tmdbId: 100 });
    });
  });

  describe('syncTrending', () => {
    it('should queue trending sync job', async () => {
      await controller.syncTrending({ page: 2, syncStats: false });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_TRENDING_FULL, {
        page: 2,
        syncStats: false,
      });
    });
  });

  describe('syncNowPlaying', () => {
    it('should queue now playing sync job', async () => {
      await controller.syncNowPlaying({ region: 'US' });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_NOW_PLAYING, {
        region: 'US',
      });
    });
  });

  describe('updateNowPlayingFlags', () => {
    it('should queue flag update job', async () => {
      await controller.updateNowPlayingFlags({ region: 'UA' });

      expect(mockQueue.add).toHaveBeenCalledWith(IngestionJob.UPDATE_NOW_PLAYING_FLAGS, {
        region: 'UA',
      });
    });
  });
});
