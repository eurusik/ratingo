import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '@/common/enums/media-type.enum';

import {
  ROTTEN_TOMATOES_RATINGS_PORT,
  type RottenTomatoesRatingsPort,
} from '@/modules/ingestion/domain/ports/rotten-tomatoes-ratings.port';
import { ROTTEN_TOMATOES_BACKFILL_REPOSITORY } from '@/modules/ingestion/domain/repositories/rotten-tomatoes-backfill.repository.interface';
import {
  BACKFILL_MDBLIST_RATINGS_BATCH_SIZE,
  IngestionJob,
  MDBLIST_DAILY_BUDGET,
  MDBLIST_RATINGS_REFRESH_DAYS,
  RATINGS_BACKFILL_QUEUE,
} from '@/modules/ingestion/ingestion.constants';

import { BackfillMdblistRatingsPipeline } from './backfill-mdblist-ratings.pipeline';

interface RepositorySetup {
  candidateBatches?: Array<Array<Record<string, unknown>>>;
  rtFetchedAt?: Date | null;
}

function buildRepositoryMock(options: RepositorySetup) {
  const { candidateBatches = [[]], rtFetchedAt = null } = options;
  let batchIndex = 0;

  return {
    findCandidates: jest.fn().mockImplementation(() => {
      const batch = candidateBatches[batchIndex] ?? [];
      batchIndex += 1;
      return Promise.resolve(batch);
    }),
    findLastFetchedAt: jest.fn().mockResolvedValue(rtFetchedAt),
    saveFetchResult: jest.fn().mockResolvedValue(undefined),
  };
}

function pendingJobs(count: number): Array<{ data: unknown }> {
  return Array.from({ length: count }, (_, i) => ({
    data: { mediaItemId: `queued-${i}`, tmdbId: 500_000 + i, type: MediaType.MOVIE },
  }));
}

function candidateRows(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    id: `media-${i}`,
    tmdbId: 1000 + i,
    type: MediaType.MOVIE,
  }));
}

describe('BackfillMdblistRatingsPipeline', () => {
  let pipeline: BackfillMdblistRatingsPipeline;
  let repository: ReturnType<typeof buildRepositoryMock>;
  let queueAddBulk: jest.Mock;
  let queueGetJobs: jest.Mock;
  let rottenTomatoesRatings: jest.Mocked<RottenTomatoesRatingsPort>;

  const setupPipeline = async (
    repositorySetup: RepositorySetup = {},
    queuedJobs: Array<{ data: unknown }> = [],
  ) => {
    repository = buildRepositoryMock(repositorySetup);

    queueAddBulk = jest.fn().mockResolvedValue([]);
    queueGetJobs = jest.fn().mockResolvedValue(queuedJobs);

    rottenTomatoesRatings = {
      getRottenTomatoesRatings: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillMdblistRatingsPipeline,
        { provide: ROTTEN_TOMATOES_BACKFILL_REPOSITORY, useValue: repository },
        {
          provide: getQueueToken(RATINGS_BACKFILL_QUEUE),
          useValue: { addBulk: queueAddBulk, getJobs: queueGetJobs },
        },
        { provide: ROTTEN_TOMATOES_RATINGS_PORT, useValue: rottenTomatoesRatings },
      ],
    }).compile();

    pipeline = module.get(BackfillMdblistRatingsPipeline);
  };

  describe('dispatch', () => {
    it('queues item jobs for rows returned by the DB batch', async () => {
      await setupPipeline({
        candidateBatches: [
          [
            { id: 'media-1', tmdbId: 101, type: MediaType.MOVIE },
            { id: 'media-2', tmdbId: 202, type: MediaType.SHOW },
          ],
          [],
        ],
      });

      await pipeline.dispatch();

      expect(queueAddBulk).toHaveBeenCalledTimes(1);
      const jobs = queueAddBulk.mock.calls[0][0];
      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toMatchObject({
        name: IngestionJob.BACKFILL_MDBLIST_RATINGS_ITEM,
        data: { mediaItemId: 'media-1', tmdbId: 101, type: MediaType.MOVIE },
      });
      expect(jobs[1]).toMatchObject({
        name: IngestionJob.BACKFILL_MDBLIST_RATINGS_ITEM,
        data: { mediaItemId: 'media-2', tmdbId: 202, type: MediaType.SHOW },
      });
    });

    it('encodes the UTC day into jobId so stuck jobs do not block next day', async () => {
      await setupPipeline({
        candidateBatches: [[{ id: 'media-1', tmdbId: 101, type: MediaType.MOVIE }], []],
      });

      await pipeline.dispatch();

      const job = queueAddBulk.mock.calls[0][0][0];
      expect(job.opts.jobId).toMatch(/^backfill-mdblist-ratings_media-1_\d{8}$/);
    });

    it('paginates through multiple batches using id cursor', async () => {
      await setupPipeline({
        candidateBatches: [
          [
            { id: 'media-1', tmdbId: 1, type: MediaType.MOVIE },
            { id: 'media-2', tmdbId: 2, type: MediaType.MOVIE },
          ],
          [{ id: 'media-3', tmdbId: 3, type: MediaType.SHOW }],
          [],
        ],
      });

      await pipeline.dispatch();

      expect(repository.findCandidates).toHaveBeenCalledTimes(3);
      expect(queueAddBulk).toHaveBeenCalledTimes(2);
      expect(queueAddBulk.mock.calls[0][0]).toHaveLength(2);
      expect(queueAddBulk.mock.calls[1][0]).toHaveLength(1);
    });

    it('skips the run without querying or queueing when MDBLIST_API_KEY is missing', async () => {
      await setupPipeline({
        candidateBatches: [[{ id: 'media-1', tmdbId: 1, type: MediaType.MOVIE }]],
      });
      rottenTomatoesRatings.isConfigured.mockReturnValue(false);

      await pipeline.dispatch();

      expect(repository.findCandidates).not.toHaveBeenCalled();
      expect(queueAddBulk).not.toHaveBeenCalled();
    });

    it('does not queue anything when no rows match the filter', async () => {
      await setupPipeline({ candidateBatches: [[]] });

      await pipeline.dispatch();

      expect(queueAddBulk).not.toHaveBeenCalled();
    });

    it('defensively filters out rows with null tmdbId', async () => {
      await setupPipeline({
        candidateBatches: [
          [
            { id: 'media-1', tmdbId: 101, type: MediaType.MOVIE },
            { id: 'media-2', tmdbId: null, type: MediaType.SHOW },
          ],
          [],
        ],
      });

      await pipeline.dispatch();

      const jobs = queueAddBulk.mock.calls[0][0];
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.tmdbId).toBe(101);
    });

    it('stops queueing once daily budget is reached (Redis bloat protection)', async () => {
      // Mock returns the same 100-item batch on every call — dispatcher
      // should stop looping once totalQueued hits MDBLIST_DAILY_BUDGET (900),
      // not drain indefinitely.
      const batch = Array.from({ length: 100 }, (_, i) => ({
        id: `media-${Math.random()}-${i}`,
        tmdbId: 1000 + i,
        type: MediaType.MOVIE,
      }));
      const manyBatches = Array.from({ length: 20 }, () => batch);
      await setupPipeline({ candidateBatches: manyBatches });

      await pipeline.dispatch();

      const totalQueued = queueAddBulk.mock.calls.reduce(
        (acc, [jobs]) => acc + (jobs as unknown[]).length,
        0,
      );
      expect(totalQueued).toBeLessThanOrEqual(MDBLIST_DAILY_BUDGET);
      // Must still queue a meaningful amount — confirms the loop ran, not
      // that it bailed on first iteration.
      expect(totalQueued).toBeGreaterThanOrEqual(MDBLIST_DAILY_BUDGET - 100);
    });

    it('looks up queued jobs in every pending state but not failed or completed', async () => {
      await setupPipeline({ candidateBatches: [[]] });

      await pipeline.dispatch();

      const states = queueGetJobs.mock.calls[0][0] as string[];
      expect(states).toEqual(
        expect.arrayContaining(['waiting', 'prioritized', 'delayed', 'paused', 'active']),
      );
      expect(states).not.toContain('failed');
      expect(states).not.toContain('completed');
    });

    it('does not re-queue items that already have a pending job from an earlier day', async () => {
      await setupPipeline(
        {
          candidateBatches: [
            [
              { id: 'media-1', tmdbId: 101, type: MediaType.MOVIE },
              { id: 'media-2', tmdbId: 202, type: MediaType.SHOW },
            ],
            [],
          ],
        },
        [{ data: { mediaItemId: 'media-1', tmdbId: 101, type: MediaType.MOVIE } }],
      );

      await pipeline.dispatch();

      const jobs = queueAddBulk.mock.calls[0][0];
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.tmdbId).toBe(202);
    });

    it('counts already-queued items toward the daily budget', async () => {
      const batch = candidateRows(100);
      await setupPipeline(
        { candidateBatches: [batch, batch, []] },
        pendingJobs(MDBLIST_DAILY_BUDGET - 50),
      );

      await pipeline.dispatch();

      expect(repository.findCandidates).toHaveBeenCalledTimes(1);
      expect(queueAddBulk).toHaveBeenCalledTimes(1);
      expect(queueAddBulk.mock.calls[0][0]).toHaveLength(50);
    });

    it('counts every pending job toward the budget, including duplicates of one item', async () => {
      const duplicate = {
        data: { mediaItemId: 'duplicated-item', tmdbId: 400_000, type: MediaType.MOVIE },
      };
      await setupPipeline({ candidateBatches: [candidateRows(100), []] }, [
        duplicate,
        duplicate,
        ...pendingJobs(MDBLIST_DAILY_BUDGET - 52),
      ]);

      await pipeline.dispatch();

      expect(queueAddBulk.mock.calls[0][0]).toHaveLength(50);
    });

    it('queues a show whose tmdbId matches an already-queued movie', async () => {
      await setupPipeline(
        { candidateBatches: [[{ id: 'show-101', tmdbId: 101, type: MediaType.SHOW }], []] },
        [{ data: { mediaItemId: 'movie-101', tmdbId: 101, type: MediaType.MOVIE } }],
      );

      await pipeline.dispatch();

      const jobs = queueAddBulk.mock.calls[0][0];
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data).toMatchObject({ mediaItemId: 'show-101', type: MediaType.SHOW });
    });

    it('gives a movie and a show with the same tmdbId distinct jobIds', async () => {
      await setupPipeline({
        candidateBatches: [
          [
            { id: 'movie-101', tmdbId: 101, type: MediaType.MOVIE },
            { id: 'show-101', tmdbId: 101, type: MediaType.SHOW },
          ],
          [],
        ],
      });

      await pipeline.dispatch();

      const [movieJob, showJob] = queueAddBulk.mock.calls[0][0];
      expect(movieJob.opts.jobId).not.toBe(showJob.opts.jobId);
    });

    it('scans the DB in full batches even when little budget is left', async () => {
      await setupPipeline({ candidateBatches: [[]] }, pendingJobs(MDBLIST_DAILY_BUDGET - 20));

      await pipeline.dispatch();

      expect(repository.findCandidates).toHaveBeenCalledWith({
        fetchedBefore: expect.any(Date),
        cursor: undefined,
        limit: BACKFILL_MDBLIST_RATINGS_BATCH_SIZE,
      });
    });

    it('queues nothing when the backlog already covers the daily budget', async () => {
      await setupPipeline(
        { candidateBatches: [[{ id: 'media-1', tmdbId: 101, type: MediaType.MOVIE }], []] },
        pendingJobs(MDBLIST_DAILY_BUDGET),
      );

      await pipeline.dispatch();

      expect(repository.findCandidates).not.toHaveBeenCalled();
      expect(queueAddBulk).not.toHaveBeenCalled();
    });
  });

  describe('processItem', () => {
    const payload = {
      mediaItemId: 'media-1',
      tmdbId: 101,
      type: MediaType.MOVIE,
    };

    it('writes both critics and audience when MDBList returns both', async () => {
      await setupPipeline();
      rottenTomatoesRatings.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: 76,
      });

      await pipeline.processItem(payload);

      expect(repository.saveFetchResult).toHaveBeenCalledWith('media-1', {
        fetchedAt: expect.any(Date),
        ratings: { rottenTomatoesCritics: 78, rottenTomatoesAudience: 76 },
        ratingsChangedAt: expect.any(Date),
      });
    });

    it('writes only critics when audience is missing', async () => {
      await setupPipeline();
      rottenTomatoesRatings.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem(payload);

      expect(repository.saveFetchResult).toHaveBeenCalledWith('media-1', {
        fetchedAt: expect.any(Date),
        ratings: { rottenTomatoesCritics: 78, rottenTomatoesAudience: null },
        ratingsChangedAt: expect.any(Date),
      });
    });

    it('writes only audience when critics is missing', async () => {
      await setupPipeline();
      rottenTomatoesRatings.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: 80,
      });

      await pipeline.processItem(payload);

      expect(repository.saveFetchResult).toHaveBeenCalledWith('media-1', {
        fetchedAt: expect.any(Date),
        ratings: { rottenTomatoesCritics: null, rottenTomatoesAudience: 80 },
        ratingsChangedAt: expect.any(Date),
      });
    });

    it('stamps rtFetchedAt when MDBList returned nothing (genuine not-found, critical for quota)', async () => {
      await setupPipeline();
      rottenTomatoesRatings.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem(payload);

      expect(repository.saveFetchResult).toHaveBeenCalledTimes(1);
      expect(repository.saveFetchResult).toHaveBeenCalledWith('media-1', {
        fetchedAt: expect.any(Date),
        ratings: { rottenTomatoesCritics: null, rottenTomatoesAudience: null },
        ratingsChangedAt: null,
      });
    });

    it('bumps ratingsChangedAt to the fetch time only when ratings were written', async () => {
      await setupPipeline();
      rottenTomatoesRatings.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem(payload);

      const [, result] = repository.saveFetchResult.mock.calls[0];
      expect(result.ratingsChangedAt).toBe(result.fetchedAt);
    });

    it('does NOT stamp rtFetchedAt and propagates the error when the adapter throws', async () => {
      await setupPipeline();
      rottenTomatoesRatings.getRottenTomatoesRatings.mockRejectedValue(new Error('MDBList 429'));

      await expect(pipeline.processItem(payload)).rejects.toThrow('MDBList 429');

      expect(repository.saveFetchResult).not.toHaveBeenCalled();
    });

    it('skips without fetching or stamping when MDBLIST_API_KEY is not configured', async () => {
      await setupPipeline();
      rottenTomatoesRatings.isConfigured.mockReturnValue(false);

      await pipeline.processItem(payload);

      expect(rottenTomatoesRatings.getRottenTomatoesRatings).not.toHaveBeenCalled();
      expect(repository.saveFetchResult).not.toHaveBeenCalled();
    });

    it('calls adapter with the correct tmdbId and type', async () => {
      await setupPipeline();
      rottenTomatoesRatings.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem({
        mediaItemId: 'media-42',
        tmdbId: 42,
        type: MediaType.SHOW,
      });

      expect(rottenTomatoesRatings.getRottenTomatoesRatings).toHaveBeenCalledWith(
        42,
        MediaType.SHOW,
      );
    });

    it('skips MDBList call when rtFetchedAt is within refresh window (duplicate quota protection)', async () => {
      await setupPipeline({ rtFetchedAt: new Date() });

      await pipeline.processItem(payload);

      expect(rottenTomatoesRatings.getRottenTomatoesRatings).not.toHaveBeenCalled();
      expect(repository.saveFetchResult).not.toHaveBeenCalled();
    });

    it('proceeds with MDBList call when rtFetchedAt is older than refresh window', async () => {
      const staleDate = new Date(
        Date.now() - (MDBLIST_RATINGS_REFRESH_DAYS + 1) * 24 * 60 * 60 * 1000,
      );
      await setupPipeline({ rtFetchedAt: staleDate });
      rottenTomatoesRatings.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: 80,
        rottenTomatoesAudience: 75,
      });

      await pipeline.processItem(payload);

      expect(rottenTomatoesRatings.getRottenTomatoesRatings).toHaveBeenCalledTimes(1);
      expect(repository.saveFetchResult).toHaveBeenCalled();
    });
  });
});
