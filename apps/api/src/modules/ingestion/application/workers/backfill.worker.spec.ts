import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';

import { MediaType } from '@/common/enums/media-type.enum';

import { ResolveImportDispatcherPipeline } from '../../../user-media/application/pipelines/resolve-import-dispatcher.pipeline';
import { ResolveImportItemPipeline } from '../../../user-media/application/pipelines/resolve-import-item.pipeline';
import { IngestionJob } from '../../ingestion.constants';
import { destroyTraktRateLimiter } from '../../infrastructure/adapters/trakt/base-trakt-http';
import { BackfillAltTitlesPipeline } from '../pipelines/backfill-alt-titles.pipeline';
import { BackfillImdbPipeline } from '../pipelines/backfill-imdb.pipeline';

import { BackfillWorker } from './backfill.worker';

afterAll(() => {
  destroyTraktRateLimiter();
});

describe('BackfillWorker', () => {
  let worker: BackfillWorker;
  let backfillAltTitlesPipeline: any;
  let backfillImdbPipeline: any;
  let resolveImportDispatcherPipeline: any;
  let resolveImportItemPipeline: any;

  beforeEach(async () => {
    backfillAltTitlesPipeline = {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillWorker,
        { provide: BackfillAltTitlesPipeline, useValue: backfillAltTitlesPipeline },
        { provide: BackfillImdbPipeline, useValue: backfillImdbPipeline },
        {
          provide: ResolveImportDispatcherPipeline,
          useValue: resolveImportDispatcherPipeline,
        },
        {
          provide: ResolveImportItemPipeline,
          useValue: resolveImportItemPipeline,
        },
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

  describe('unknown job types', () => {
    it('should log warning for unknown job type', async () => {
      const job = { name: 'UNKNOWN_BACKFILL_JOB' as any, data: {}, id: 'unknown-1' } as Job;
      const loggerSpy = jest.spyOn((worker as any).logger, 'warn');

      await worker.process(job);

      expect(loggerSpy).toHaveBeenCalledWith('Unknown backfill job type: UNKNOWN_BACKFILL_JOB');
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
