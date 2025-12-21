import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NewReleasesPipeline } from './new-releases.pipeline';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { MEDIA_REPOSITORY } from '../../../catalog/domain/repositories/media.repository.interface';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';

describe('NewReleasesPipeline', () => {
  let pipeline: NewReleasesPipeline;
  let tmdbAdapter: any;
  let mediaRepository: any;
  let ingestionQueue: any;

  beforeEach(async () => {
    tmdbAdapter = {
      getNewReleaseIds: jest.fn().mockResolvedValue([]),
    };

    mediaRepository = {
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
    };

    ingestionQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      addBulk: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewReleasesPipeline,
        { provide: TmdbAdapter, useValue: tmdbAdapter },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
      ],
    }).compile();

    pipeline = module.get<NewReleasesPipeline>(NewReleasesPipeline);
  });

  describe('sync', () => {
    it('should fetch new releases and enqueue missing items', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([100, 200, 300]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 100 }]);

      await pipeline.sync('UA', 30);

      expect(tmdbAdapter.getNewReleaseIds).toHaveBeenCalledWith(30, 'UA');
      expect(mediaRepository.findManyByTmdbIds).toHaveBeenCalledWith([100, 200, 300]);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: IngestionJob.SYNC_MOVIE,
            data: { tmdbId: 200 },
          }),
          expect.objectContaining({
            name: IngestionJob.SYNC_MOVIE,
            data: { tmdbId: 300 },
          }),
        ]),
      );
    });

    it('should skip if no new releases found', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([]);

      await pipeline.sync('UA', 30);

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
    });

    it('should skip if all items already exist', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([100, 200]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 100 }, { tmdbId: 200 }]);

      await pipeline.sync('UA', 30);

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
    });

    it('should deduplicate jobs before adding', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([100, 200]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([]);
      ingestionQueue.getJob
        .mockResolvedValueOnce({ id: 'existing-job' })
        .mockResolvedValueOnce(null);

      await pipeline.sync('UA', 30);

      expect(ingestionQueue.getJob).toHaveBeenCalledTimes(2);
      expect(ingestionQueue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          data: { tmdbId: 200 },
        }),
      ]);
    });
  });
});
