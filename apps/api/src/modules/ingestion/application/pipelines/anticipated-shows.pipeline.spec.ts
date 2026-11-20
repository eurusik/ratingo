import { Test, type TestingModule } from '@nestjs/testing';

import { ANTICIPATED_SHOWS_MIN_LIST_COUNT } from '@/common/constants';
import { ANTICIPATED_SHOWS_REPOSITORY } from '@/modules/ingestion/domain/repositories/anticipated-shows.repository.interface';
import {
  ANTICIPATED_IMPORT_RUN_CAP,
  ANTICIPATED_REFRESH_RUN_CAP,
  ANTICIPATED_SHOWS_FETCH_LIMIT,
  IngestionJob,
} from '@/modules/ingestion/ingestion.constants';
import { CLOCK_PORT } from '@/modules/shared/clock';
import { TRAKT_LISTS_PORT } from '@/modules/trakt/public';

import { BulkJobService } from '../services/bulk-job.service';

import { AnticipatedShowsPipeline } from './anticipated-shows.pipeline';

const NOW = new Date('2026-11-20T05:30:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

describe('AnticipatedShowsPipeline', () => {
  let pipeline: AnticipatedShowsPipeline;
  let traktLists: { getAnticipatedShows: jest.Mock };
  let bulkJobService: { enqueueBulk: jest.Mock };
  let repository: {
    replaceSnapshot: jest.Mock;
    findMissingTmdbIds: jest.Mock;
    findTmdbIdsToRefresh: jest.Mock;
  };

  beforeEach(async () => {
    traktLists = { getAnticipatedShows: jest.fn().mockResolvedValue([]) };
    bulkJobService = {
      enqueueBulk: jest.fn().mockResolvedValue({ found: 0, enqueued: 0, deduped: 0 }),
    };
    repository = {
      replaceSnapshot: jest.fn().mockResolvedValue(undefined),
      findMissingTmdbIds: jest.fn().mockResolvedValue([]),
      findTmdbIdsToRefresh: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnticipatedShowsPipeline,
        { provide: TRAKT_LISTS_PORT, useValue: traktLists },
        { provide: BulkJobService, useValue: bulkJobService },
        { provide: ANTICIPATED_SHOWS_REPOSITORY, useValue: repository },
        { provide: CLOCK_PORT, useValue: { now: () => NOW } },
      ],
    }).compile();

    pipeline = module.get(AnticipatedShowsPipeline);
  });

  const enqueuedJobs = (call: number) =>
    bulkJobService.enqueueBulk.mock.calls[call][0] as Array<{
      name: string;
      data: { tmdbId: number };
      opts: { jobId: string };
    }>;

  it('stores the fetched anticipated shows as the new snapshot', async () => {
    const shows = [{ tmdbId: 1, listCount: 60_000, rank: 1 }];
    traktLists.getAnticipatedShows.mockResolvedValue(shows);

    await pipeline.sync();

    expect(traktLists.getAnticipatedShows).toHaveBeenCalledWith(ANTICIPATED_SHOWS_FETCH_LIMIT);
    expect(repository.replaceSnapshot).toHaveBeenCalledWith(shows, NOW);
  });

  it.each([
    ['Trakt fails', null],
    ['Trakt returns an empty list', []],
  ])('keeps the previous snapshot when %s', async (_case, response) => {
    traktLists.getAnticipatedShows.mockResolvedValue(response);
    repository.findMissingTmdbIds.mockResolvedValue([7]);

    await pipeline.sync();

    expect(repository.replaceSnapshot).not.toHaveBeenCalled();
    expect(repository.findMissingTmdbIds).toHaveBeenCalled();
  });

  it('imports anticipated shows above the threshold that are missing from the database', async () => {
    repository.findMissingTmdbIds.mockResolvedValue([10, 20]);

    await pipeline.sync();

    expect(repository.findMissingTmdbIds).toHaveBeenCalledWith({
      minListCount: ANTICIPATED_SHOWS_MIN_LIST_COUNT,
      limit: ANTICIPATED_IMPORT_RUN_CAP,
    });
    expect(enqueuedJobs(0)).toEqual([
      {
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId: 10 },
        opts: { jobId: 'ant_show_10_20261120' },
      },
      {
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId: 20 },
        opts: { jobId: 'ant_show_20_20261120' },
      },
    ]);
  });

  it('refreshes stored anticipated shows not synced in the last 20 hours, capped per run', async () => {
    repository.findTmdbIdsToRefresh.mockResolvedValue([30]);

    await pipeline.sync();

    expect(repository.findTmdbIdsToRefresh).toHaveBeenCalledWith({
      minListCount: ANTICIPATED_SHOWS_MIN_LIST_COUNT,
      syncedBefore: new Date(NOW.getTime() - 20 * HOUR_MS),
      limit: ANTICIPATED_REFRESH_RUN_CAP,
    });
    expect(enqueuedJobs(0)).toEqual([
      {
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId: 30 },
        opts: { jobId: 'antr_show_30_20261120' },
      },
    ]);
  });

  it('enqueues nothing when every anticipated show is present and fresh', async () => {
    await pipeline.sync();

    expect(bulkJobService.enqueueBulk).not.toHaveBeenCalled();
  });
});
