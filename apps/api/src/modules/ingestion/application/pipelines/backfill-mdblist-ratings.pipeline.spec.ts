import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '@/common/enums/media-type.enum';
import { DATABASE_CONNECTION } from '@/database/database.module';

import { MdblistAdapter } from '../../infrastructure/adapters/mdblist/mdblist.adapter';
import { IngestionJob, RATINGS_BACKFILL_QUEUE } from '../../ingestion.constants';

import { BackfillMdblistRatingsPipeline } from './backfill-mdblist-ratings.pipeline';

/**
 * Lightweight Drizzle mock: `db.select().from().where().orderBy().limit()`
 * is a thenable chain whose terminal `limit()` is awaited. We intercept at
 * `limit()` (the leaf) to return test fixtures.
 */
function buildDbMock(options: { selectBatches?: Array<Array<Record<string, unknown>>> }) {
  const { selectBatches = [[]] } = options;
  let batchIndex = 0;

  const limit = jest.fn().mockImplementation(() => {
    const batch = selectBatches[batchIndex] ?? [];
    batchIndex += 1;
    return Promise.resolve(batch);
  });
  const orderBy = jest.fn().mockReturnValue({ limit });
  const where = jest.fn().mockReturnValue({ orderBy });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const updateSet = jest.fn();
  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const update = jest.fn().mockImplementation(() => {
    return {
      set: jest.fn().mockImplementation((payload: unknown) => {
        updateSet(payload);
        return { where: updateWhere };
      }),
    };
  });

  return {
    db: { select, update },
    spies: { select, from, where, orderBy, limit, update, updateSet, updateWhere },
  };
}

describe('BackfillMdblistRatingsPipeline', () => {
  let pipeline: BackfillMdblistRatingsPipeline;
  let dbSpies: ReturnType<typeof buildDbMock>['spies'];
  let queueAddBulk: jest.Mock;
  let mdblistAdapter: jest.Mocked<Pick<MdblistAdapter, 'getRottenTomatoesRatings'>>;

  const setupPipeline = async (dbSetup: Parameters<typeof buildDbMock>[0] = {}) => {
    const { db, spies } = buildDbMock(dbSetup);
    dbSpies = spies;

    queueAddBulk = jest.fn().mockResolvedValue([]);

    mdblistAdapter = {
      getRottenTomatoesRatings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillMdblistRatingsPipeline,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: getQueueToken(RATINGS_BACKFILL_QUEUE), useValue: { addBulk: queueAddBulk } },
        { provide: MdblistAdapter, useValue: mdblistAdapter },
      ],
    }).compile();

    pipeline = module.get(BackfillMdblistRatingsPipeline);
  };

  describe('dispatch', () => {
    it('queues item jobs for rows returned by the DB batch', async () => {
      await setupPipeline({
        selectBatches: [
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
        selectBatches: [[{ id: 'media-1', tmdbId: 101, type: MediaType.MOVIE }], []],
      });

      await pipeline.dispatch();

      const job = queueAddBulk.mock.calls[0][0][0];
      // jobId: "backfill-mdblist-ratings_<tmdbId>_<YYYYMMDD>" (formatUtcDayId format)
      expect(job.opts.jobId).toMatch(/^backfill-mdblist-ratings_101_\d{8}$/);
    });

    it('paginates through multiple batches using id cursor', async () => {
      await setupPipeline({
        selectBatches: [
          [
            { id: 'media-1', tmdbId: 1, type: MediaType.MOVIE },
            { id: 'media-2', tmdbId: 2, type: MediaType.MOVIE },
          ],
          [{ id: 'media-3', tmdbId: 3, type: MediaType.SHOW }],
          [],
        ],
      });

      await pipeline.dispatch();

      expect(dbSpies.limit).toHaveBeenCalledTimes(3);
      expect(queueAddBulk).toHaveBeenCalledTimes(2);
      expect(queueAddBulk.mock.calls[0][0]).toHaveLength(2);
      expect(queueAddBulk.mock.calls[1][0]).toHaveLength(1);
    });

    it('does not queue anything when no rows match the filter', async () => {
      await setupPipeline({ selectBatches: [[]] });

      await pipeline.dispatch();

      expect(queueAddBulk).not.toHaveBeenCalled();
    });

    it('defensively filters out rows with null tmdbId', async () => {
      await setupPipeline({
        selectBatches: [
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
  });

  describe('processItem', () => {
    const payload = {
      mediaItemId: 'media-1',
      tmdbId: 101,
      type: MediaType.MOVIE,
    };

    it('writes both critics and audience when MDBList returns both', async () => {
      await setupPipeline();
      mdblistAdapter.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: 76,
      });

      await pipeline.processItem(payload);

      expect(dbSpies.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingRottenTomatoes: 78,
          ratingRottenTomatoesAudience: 76,
        }),
      );
    });

    it('writes only critics when audience is missing', async () => {
      await setupPipeline();
      mdblistAdapter.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem(payload);

      const setPayload = dbSpies.updateSet.mock.calls[0][0];
      expect(setPayload).toHaveProperty('ratingRottenTomatoes', 78);
      expect(setPayload).not.toHaveProperty('ratingRottenTomatoesAudience');
    });

    it('writes only audience when critics is missing', async () => {
      await setupPipeline();
      mdblistAdapter.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: 80,
      });

      await pipeline.processItem(payload);

      const setPayload = dbSpies.updateSet.mock.calls[0][0];
      expect(setPayload).toHaveProperty('ratingRottenTomatoesAudience', 80);
      expect(setPayload).not.toHaveProperty('ratingRottenTomatoes');
    });

    it('ALWAYS stamps rtFetchedAt even when MDBList returned nothing (critical for quota)', async () => {
      await setupPipeline();
      mdblistAdapter.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem(payload);

      expect(dbSpies.update).toHaveBeenCalledTimes(1);
      const setPayload = dbSpies.updateSet.mock.calls[0][0];
      expect(setPayload.rtFetchedAt).toBeInstanceOf(Date);
      expect(setPayload).not.toHaveProperty('ratingRottenTomatoes');
      expect(setPayload).not.toHaveProperty('ratingRottenTomatoesAudience');
    });

    it('does NOT bump updatedAt when only rtFetchedAt changed (avoid ISR churn)', async () => {
      await setupPipeline();
      mdblistAdapter.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem(payload);

      const setPayload = dbSpies.updateSet.mock.calls[0][0];
      expect(setPayload).not.toHaveProperty('updatedAt');
    });

    it('bumps updatedAt when rating data was written', async () => {
      await setupPipeline();
      mdblistAdapter.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: 76,
      });

      await pipeline.processItem(payload);

      const setPayload = dbSpies.updateSet.mock.calls[0][0];
      expect(setPayload.updatedAt).toBeInstanceOf(Date);
    });

    it('calls adapter with the correct tmdbId and type', async () => {
      await setupPipeline();
      mdblistAdapter.getRottenTomatoesRatings.mockResolvedValue({
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: null,
      });

      await pipeline.processItem({
        mediaItemId: 'media-42',
        tmdbId: 42,
        type: MediaType.SHOW,
      });

      expect(mdblistAdapter.getRottenTomatoesRatings).toHaveBeenCalledWith(42, MediaType.SHOW);
    });
  });
});
