import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NowPlayingPipeline } from './now-playing.pipeline';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { MEDIA_REPOSITORY } from '../../../catalog/domain/repositories/media.repository.interface';
import { MOVIE_REPOSITORY } from '../../../catalog/domain/repositories/movie.repository.interface';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';

describe('NowPlayingPipeline', () => {
  let pipeline: NowPlayingPipeline;
  let tmdbAdapter: any;
  let mediaRepository: any;
  let movieRepository: any;
  let ingestionQueue: any;

  beforeEach(async () => {
    tmdbAdapter = {
      getNowPlayingIds: jest.fn().mockResolvedValue([]),
    };

    mediaRepository = {
      findManyByTmdbIds: jest.fn().mockResolvedValue([]),
    };

    movieRepository = {
      setNowPlaying: jest.fn().mockResolvedValue(undefined),
    };

    ingestionQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      addBulk: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NowPlayingPipeline,
        { provide: TmdbAdapter, useValue: tmdbAdapter },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: MOVIE_REPOSITORY, useValue: movieRepository },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: ingestionQueue },
      ],
    }).compile();

    pipeline = module.get<NowPlayingPipeline>(NowPlayingPipeline);
  });

  describe('sync', () => {
    it('should fetch now playing and enqueue missing items', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([100, 200, 300]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 100 }]);

      await pipeline.sync('UA');

      expect(tmdbAdapter.getNowPlayingIds).toHaveBeenCalledWith('UA');
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

    it('should skip if no now playing found', async () => {
      tmdbAdapter.getNowPlayingIds.mockResolvedValue([]);

      await pipeline.sync('UA');

      expect(ingestionQueue.addBulk).not.toHaveBeenCalled();
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
