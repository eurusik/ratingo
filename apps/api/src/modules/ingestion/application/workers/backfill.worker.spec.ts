import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';

import { MediaType } from '@/common/enums/media-type.enum';

import { LINK_PENDING_IMPORTS_SWEEP } from '@/modules/user-media/public';
import { ResolveImportDispatcherPipeline } from '@/modules/user-media/application/pipelines/resolve-import-dispatcher.pipeline';
import { ResolveImportItemPipeline } from '@/modules/user-media/application/pipelines/resolve-import-item.pipeline';
import { IngestionJob } from '@/modules/ingestion/ingestion.constants';
import { destroyTraktRateLimiter } from '@/modules/trakt/infrastructure/adapters/base-trakt-http';
import { BackfillAltTitlesPipeline } from '../pipelines/backfill-alt-titles.pipeline';
import { BackfillEpisodeDetailsPipeline } from '../pipelines/backfill-episode-details.pipeline';
import { BackfillImdbPipeline } from '../pipelines/backfill-imdb.pipeline';

import { BackfillWorker } from './backfill.worker';

afterAll(() => {
  destroyTraktRateLimiter();
});

describe('BackfillWorker', () => {
  let worker: BackfillWorker;
  let backfillAltTitlesPipeline: any;
  let backfillEpisodeDetailsPipeline: any;
  let backfillImdbPipeline: any;
  let resolveImportDispatcherPipeline: any;
  let resolveImportItemPipeline: any;
  let linkPendingImportsSweeper: any;

  beforeEach(async () => {
    backfillAltTitlesPipeline = {
      processItem: jest.fn().mockResolvedValue(undefined),
    };

    backfillEpisodeDetailsPipeline = {
      processItem: jest.fn().mockResolvedValue(undefined),
    };

    backfillImdbPipeline = {
      processItem: jest.fn().mockResolvedValue(undefined),
    };

    resolveImportDispatcherPipeline = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    resolveImportItemPipeline = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    linkPendingImportsSweeper = {
      execute: jest.fn().mockResolvedValue({ linked: 0, timedOut: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillWorker,
        { provide: BackfillAltTitlesPipeline, useValue: backfillAltTitlesPipeline },
        { provide: BackfillEpisodeDetailsPipeline, useValue: backfillEpisodeDetailsPipeline },
        { provide: BackfillImdbPipeline, useValue: backfillImdbPipeline },
        {
          provide: ResolveImportDispatcherPipeline,
          useValue: resolveImportDispatcherPipeline,
        },
        {
          provide: ResolveImportItemPipeline,
          useValue: resolveImportItemPipeline,
        },
        { provide: LINK_PENDING_IMPORTS_SWEEP, useValue: linkPendingImportsSweeper },
      ],
    }).compile();

    worker = module.get<BackfillWorker>(BackfillWorker);
  });

  describe('process - BACKFILL_ALT_TITLES_ITEM', () => {
    it('should route to backfillAltTitlesPipeline.processItem()', async () => {
      const job = {
        name: IngestionJob.BACKFILL_ALT_TITLES_ITEM,
        data: {
          mediaItemId: 'item-1',
          tmdbId: 550,
          type: MediaType.MOVIE,
          title: 'Test Movie',
          originalTitle: 'Original Test',
        },
        id: 'alt-titles-1',
      } as Job;

      await worker.process(job);

      expect(backfillAltTitlesPipeline.processItem).toHaveBeenCalledWith({
        mediaItemId: 'item-1',
        tmdbId: 550,
        type: MediaType.MOVIE,
        title: 'Test Movie',
        originalTitle: 'Original Test',
      });
    });
  });

  describe('process - BACKFILL_EPISODE_DETAILS_ITEM', () => {
    it('should route to backfillEpisodeDetailsPipeline.processItem()', async () => {
      const job = {
        name: IngestionJob.BACKFILL_EPISODE_DETAILS_ITEM,
        data: { showId: 'show-1', tmdbId: 1399 },
        id: 'episode-details-1',
      } as Job;

      await worker.process(job);

      expect(backfillEpisodeDetailsPipeline.processItem).toHaveBeenCalledWith({
        showId: 'show-1',
        tmdbId: 1399,
      });
    });
  });

  describe('process - BACKFILL_IMDB_ITEM', () => {
    it('should route to backfillImdbPipeline.processItem()', async () => {
      const job = {
        name: IngestionJob.BACKFILL_IMDB_ITEM,
        data: { tmdbId: 100 },
        id: 'imdb-1',
      } as Job;

      await worker.process(job);

      expect(backfillImdbPipeline.processItem).toHaveBeenCalledWith(100, 'imdb-1');
    });
  });

  describe('process - LINK_PENDING_IMPORTS', () => {
    it('should route to linkPendingImportsSweeper.execute()', async () => {
      const job = { name: IngestionJob.LINK_PENDING_IMPORTS, data: {}, id: 'sweep-1' } as Job;

      await worker.process(job);

      expect(linkPendingImportsSweeper.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('unknown job types', () => {
    it('should log warning for unknown job type', async () => {
      const job = { name: 'UNKNOWN_BACKFILL_JOB' as any, data: {}, id: 'unknown-1' } as Job;
      const loggerSpy = jest.spyOn((worker as any).logger, 'warn');

      await worker.process(job);

      expect(loggerSpy).toHaveBeenCalledWith({
        message: 'Unknown backfill job type',
        jobId: 'unknown-1',
        jobName: 'UNKNOWN_BACKFILL_JOB',
      });
    });
  });

  describe('error handling', () => {
    it('should log and rethrow errors', async () => {
      const error = new Error('Pipeline failed');
      backfillImdbPipeline.processItem.mockRejectedValue(error);

      const job = {
        name: IngestionJob.BACKFILL_IMDB_ITEM,
        data: { tmdbId: 100 },
        id: 'err-1',
      } as Job;

      await expect(worker.process(job)).rejects.toThrow(error);
    });
  });
});
