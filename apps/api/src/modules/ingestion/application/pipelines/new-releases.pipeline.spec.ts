import { Test, TestingModule } from '@nestjs/testing';
import { NewReleasesPipeline } from './new-releases.pipeline';
import { TmdbAdapter } from '../../../tmdb/public';
import { BulkJobService } from '../services/bulk-job.service';
import { MEDIA_REPOSITORY } from '../../../catalog/public';
import { IngestionJob } from '../../ingestion.constants';

describe('NewReleasesPipeline', () => {
  let pipeline: NewReleasesPipeline;
  let tmdbAdapter: jest.Mocked<TmdbAdapter>;
  let bulkJobService: jest.Mocked<BulkJobService>;
  let mediaRepository: any;

  beforeEach(async () => {
    const mockTmdbAdapter = {
      getNewReleaseIds: jest.fn().mockResolvedValue([]),
    };

    const mockBulkJobService = {
      enqueueBulk: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
    };

    const mockMediaRepository = {
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewReleasesPipeline,
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
        { provide: BulkJobService, useValue: mockBulkJobService },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
      ],
    }).compile();

    pipeline = module.get<NewReleasesPipeline>(NewReleasesPipeline);
    tmdbAdapter = module.get(TmdbAdapter);
    bulkJobService = module.get(BulkJobService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
  });

  describe('sync', () => {
    it('should fetch new releases and enqueue missing items', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([100, 200, 300]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 100 }]);

      await pipeline.sync('UA', 30);

      expect(tmdbAdapter.getNewReleaseIds).toHaveBeenCalledWith(30, 'UA');
      expect(mediaRepository.findManyByTmdbIds).toHaveBeenCalledWith([100, 200, 300]);
      expect(bulkJobService.enqueueBulk).toHaveBeenCalledWith(
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
        expect.any(Object),
        expect.any(String),
      );
    });

    it('should skip if no new releases found', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([]);

      await pipeline.sync('UA', 30);

      expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
    });

    it('should skip if all items already exist', async () => {
      tmdbAdapter.getNewReleaseIds.mockResolvedValue([100, 200]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 100 }, { tmdbId: 200 }]);

      await pipeline.sync('UA', 30);

      expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
    });
  });
});
