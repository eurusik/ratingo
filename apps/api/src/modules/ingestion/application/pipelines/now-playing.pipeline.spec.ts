import { Test, TestingModule } from '@nestjs/testing';
import { NowPlayingPipeline } from './now-playing.pipeline';
import { TmdbAdapter } from '../../../tmdb/public';
import { BulkJobService } from '../services/bulk-job.service';
import { MEDIA_REPOSITORY, MOVIE_REPOSITORY } from '../../../catalog/public';
import { IngestionJob } from '../../ingestion.constants';

describe('NowPlayingPipeline', () => {
  let pipeline: NowPlayingPipeline;
  let tmdbAdapter: jest.Mocked<TmdbAdapter>;
  let bulkJobService: jest.Mocked<BulkJobService>;
  let mediaRepository: any;
  let movieRepository: any;

  beforeEach(async () => {
    const mockTmdbAdapter = {
      getNowPlayingIds: jest.fn().mockResolvedValue([]),
    };

    const mockBulkJobService = {
      enqueueBulk: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
    };

    const mockMediaRepository = {
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
    };

    const mockMovieRepository = {
      setNowPlaying: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NowPlayingPipeline,
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
        { provide: BulkJobService, useValue: mockBulkJobService },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
        { provide: MOVIE_REPOSITORY, useValue: mockMovieRepository },
      ],
    }).compile();

    pipeline = module.get<NowPlayingPipeline>(NowPlayingPipeline);
    tmdbAdapter = module.get(TmdbAdapter);
    bulkJobService = module.get(BulkJobService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
    movieRepository = module.get(MOVIE_REPOSITORY);
  });

  describe('sync', () => {
    it('should fetch now playing and enqueue missing items', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([100, 200, 300]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 100 }]);

      await pipeline.sync('UA');

      expect(tmdbAdapter.getNowPlayingIds).toHaveBeenCalledWith('UA');
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

    it('should skip if no now playing found', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([]);

      await pipeline.sync('UA');

      expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
    });
  });

  describe('updateFlags', () => {
    it('should update now playing flags', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([100, 200]);

      await pipeline.updateFlags('UA');

      expect(tmdbAdapter.getNowPlayingIds).toHaveBeenCalledWith('UA');
      expect(movieRepository.setNowPlaying).toHaveBeenCalledWith([100, 200]);
    });
  });
});
