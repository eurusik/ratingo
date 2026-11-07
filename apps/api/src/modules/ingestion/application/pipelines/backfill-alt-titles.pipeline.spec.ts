import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '@/common/enums/media-type.enum';
import { formatUtcDayId } from '@/common/utils/date.util';

import { MEDIA_REPOSITORY } from '@/modules/catalog/public';
import { TmdbAdapter } from '@/modules/tmdb/public';
import { ALT_TITLES_BACKFILL_REPOSITORY } from '@/modules/ingestion/domain/repositories/alt-titles-backfill.repository.interface';
import { BACKFILL_QUEUE, IngestionJob } from '@/modules/ingestion/ingestion.constants';

import { BackfillAltTitlesPipeline } from './backfill-alt-titles.pipeline';

function buildRepositoryMock(candidateBatches: Array<Array<Record<string, unknown>>>) {
  let batchIndex = 0;
  return {
    findCandidates: jest.fn().mockImplementation(() => {
      const batch = candidateBatches[batchIndex] ?? [];
      batchIndex += 1;
      return Promise.resolve(batch);
    }),
  };
}

describe('BackfillAltTitlesPipeline', () => {
  let pipeline: BackfillAltTitlesPipeline;
  let queueAddBulk: jest.Mock;

  const setupPipeline = async (candidateBatches: Array<Array<Record<string, unknown>>>) => {
    queueAddBulk = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillAltTitlesPipeline,
        {
          provide: ALT_TITLES_BACKFILL_REPOSITORY,
          useValue: buildRepositoryMock(candidateBatches),
        },
        { provide: getQueueToken(BACKFILL_QUEUE), useValue: { addBulk: queueAddBulk } },
        { provide: TmdbAdapter, useValue: { getAlternativeTitles: jest.fn() } },
        { provide: MEDIA_REPOSITORY, useValue: { updateAlternativeTitles: jest.fn() } },
      ],
    }).compile();

    pipeline = module.get(BackfillAltTitlesPipeline);
  };

  describe('dispatch', () => {
    it('gives a movie and a show with the same tmdbId distinct jobIds', async () => {
      await setupPipeline([
        [
          {
            id: 'movie-uuid',
            tmdbId: 42,
            type: MediaType.MOVIE,
            title: 'Movie',
            originalTitle: null,
          },
          {
            id: 'show-uuid',
            tmdbId: 42,
            type: MediaType.SHOW,
            title: 'Show',
            originalTitle: null,
          },
        ],
        [],
      ]);

      await pipeline.dispatch();

      const day = formatUtcDayId();
      const jobs = queueAddBulk.mock.calls[0][0];
      expect(jobs).toEqual([
        {
          name: IngestionJob.BACKFILL_ALT_TITLES_ITEM,
          data: {
            mediaItemId: 'movie-uuid',
            tmdbId: 42,
            type: MediaType.MOVIE,
            title: 'Movie',
            originalTitle: null,
          },
          opts: { jobId: `backfill-alt_movie-uuid_${day}` },
        },
        {
          name: IngestionJob.BACKFILL_ALT_TITLES_ITEM,
          data: {
            mediaItemId: 'show-uuid',
            tmdbId: 42,
            type: MediaType.SHOW,
            title: 'Show',
            originalTitle: null,
          },
          opts: { jobId: `backfill-alt_show-uuid_${day}` },
        },
      ]);
      expect(jobs[0].opts.jobId).not.toBe(jobs[1].opts.jobId);
    });
  });
});
