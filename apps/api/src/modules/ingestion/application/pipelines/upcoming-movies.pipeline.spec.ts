import { Test, type TestingModule } from '@nestjs/testing';

import { MediaType } from '@/common/enums/media-type.enum';
import { MEDIA_REPOSITORY } from '@/modules/catalog/public';
import { UPCOMING_MOVIES_REPOSITORY } from '@/modules/ingestion/domain/repositories/upcoming-movies.repository.interface';
import { IngestionJob, UPCOMING_REFRESH_RUN_CAP } from '@/modules/ingestion/ingestion.constants';
import { CLOCK_PORT } from '@/modules/shared/clock';
import { TmdbAdapter } from '@/modules/tmdb/public';

import { BulkJobService } from '../services/bulk-job.service';

import { UpcomingMoviesPipeline } from './upcoming-movies.pipeline';

const NOW = new Date('2026-11-17T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('UpcomingMoviesPipeline', () => {
  let pipeline: UpcomingMoviesPipeline;
  let tmdbAdapter: { getUpcomingMovieIds: jest.Mock };
  let bulkJobService: { enqueueBulk: jest.Mock };
  let mediaRepository: { findManyByTmdbIds: jest.Mock };
  let upcomingMoviesRepository: { findTmdbIdsToRefresh: jest.Mock };

  beforeEach(async () => {
    tmdbAdapter = { getUpcomingMovieIds: jest.fn().mockResolvedValue([]) };
    bulkJobService = {
      enqueueBulk: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
    };
    mediaRepository = { findManyByTmdbIds: jest.fn().mockResolvedValue([]) };
    upcomingMoviesRepository = { findTmdbIdsToRefresh: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpcomingMoviesPipeline,
        { provide: TmdbAdapter, useValue: tmdbAdapter },
        { provide: BulkJobService, useValue: bulkJobService },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
        { provide: UPCOMING_MOVIES_REPOSITORY, useValue: upcomingMoviesRepository },
        { provide: CLOCK_PORT, useValue: { now: () => NOW } },
      ],
    }).compile();

    pipeline = module.get(UpcomingMoviesPipeline);
  });

  const enqueuedJobs = () =>
    bulkJobService.enqueueBulk.mock.calls[0][0] as Array<{
      name: string;
      data: { tmdbId: number };
      opts: { jobId: string };
    }>;

  describe('sync', () => {
    it('enqueues SYNC_MOVIE only for upcoming movies missing from the database', async () => {
      tmdbAdapter.getUpcomingMovieIds.mockResolvedValue([100, 200, 300]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 200 }]);

      await pipeline.sync();

      expect(mediaRepository.findManyByTmdbIds).toHaveBeenCalledWith(
        [100, 200, 300],
        MediaType.MOVIE,
      );
      expect(enqueuedJobs().map((j) => j.data.tmdbId)).toEqual([100, 300]);
      expect(enqueuedJobs().every((j) => j.name === IngestionJob.SYNC_MOVIE)).toBe(true);
    });

    it('uses an up-prefixed day-scoped job id distinct from new-releases and trending', async () => {
      tmdbAdapter.getUpcomingMovieIds.mockResolvedValue([100]);

      await pipeline.sync();

      expect(enqueuedJobs()[0].opts.jobId).toMatch(/^up_movie_100_\d{8}$/);
    });

    it('does nothing when TMDB returns no upcoming movies', async () => {
      await pipeline.sync();

      expect(mediaRepository.findManyByTmdbIds).not.toHaveBeenCalled();
      expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
    });

    it('does nothing when all upcoming movies already exist', async () => {
      tmdbAdapter.getUpcomingMovieIds.mockResolvedValue([100]);
      mediaRepository.findManyByTmdbIds.mockResolvedValue([{ tmdbId: 100 }]);

      await pipeline.sync();

      expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('defaults to the soon window: released within the last 14 days up to 14 days ahead', async () => {
      await pipeline.refresh();

      expect(upcomingMoviesRepository.findTmdbIdsToRefresh).toHaveBeenCalledWith({
        releasedAfter: new Date(NOW.getTime() - 14 * DAY_MS),
        releasedBefore: new Date(NOW.getTime() + 14 * DAY_MS),
        syncedBefore: new Date(NOW.getTime() - 20 * 60 * 60 * 1000),
        limit: UPCOMING_REFRESH_RUN_CAP,
      });
    });

    it('has no upper bound for the all scope', async () => {
      await pipeline.refresh('all');

      expect(upcomingMoviesRepository.findTmdbIdsToRefresh).toHaveBeenCalledWith(
        expect.objectContaining({
          releasedAfter: new Date(NOW.getTime() - 14 * DAY_MS),
          releasedBefore: null,
        }),
      );
    });

    it('keeps the soon window for an unknown scope', async () => {
      await pipeline.refresh('Soon' as never);

      expect(upcomingMoviesRepository.findTmdbIdsToRefresh).toHaveBeenCalledWith(
        expect.objectContaining({ releasedBefore: new Date(NOW.getTime() + 14 * DAY_MS) }),
      );
    });

    it('re-syncs already imported movies with an upr-prefixed day-scoped job id', async () => {
      upcomingMoviesRepository.findTmdbIdsToRefresh.mockResolvedValue([10, 20]);

      await pipeline.refresh('soon');

      expect(enqueuedJobs().map((j) => j.data.tmdbId)).toEqual([10, 20]);
      expect(enqueuedJobs()[0].name).toBe(IngestionJob.SYNC_MOVIE);
      expect(enqueuedJobs()[0].opts.jobId).toMatch(/^upr_movie_10_\d{8}$/);
    });

    it('does not enqueue anything when nothing needs a refresh', async () => {
      await pipeline.refresh('all');

      expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
    });
  });
});
