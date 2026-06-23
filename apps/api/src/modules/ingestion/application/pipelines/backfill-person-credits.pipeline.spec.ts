import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '@/database/database.module';

import { PERSON_CREDITS_WRITER } from '../../../person/public';
import { BACKFILL_QUEUE, IngestionJob } from '../../ingestion.constants';

import { BackfillPersonCreditsPipeline } from './backfill-person-credits.pipeline';

/**
 * Lightweight Drizzle mock:
 *   dispatcher:  db.select().from().where().orderBy().limit()
 *   processItem: db.select().from().where().limit()
 */
function buildDbMock(selectBatches: Array<Array<Record<string, unknown>>>) {
  let batchIndex = 0;
  const limit = jest.fn().mockImplementation(() => {
    const batch = selectBatches[batchIndex] ?? [];
    batchIndex += 1;
    return Promise.resolve(batch);
  });
  const orderBy = jest.fn().mockReturnValue({ limit });
  const where = jest.fn().mockReturnValue({ orderBy, limit });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { db: { select }, spies: { select, where, orderBy, limit } };
}

describe('BackfillPersonCreditsPipeline', () => {
  let pipeline: BackfillPersonCreditsPipeline;
  let queueAddBulk: jest.Mock;
  let writeFromCredits: jest.Mock;

  const setup = async (selectBatches: Array<Array<Record<string, unknown>>> = [[]]) => {
    const { db } = buildDbMock(selectBatches);
    queueAddBulk = jest.fn().mockResolvedValue([]);
    writeFromCredits = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillPersonCreditsPipeline,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: getQueueToken(BACKFILL_QUEUE), useValue: { addBulk: queueAddBulk } },
        { provide: PERSON_CREDITS_WRITER, useValue: { writeFromCredits } },
      ],
    }).compile();

    pipeline = module.get(BackfillPersonCreditsPipeline);
  };

  describe('dispatch', () => {
    it('queues a per-item job for each media row, then stops on the empty batch', async () => {
      await setup([[{ id: 'media-1' }, { id: 'media-2' }], []]);

      await pipeline.dispatch();

      expect(queueAddBulk).toHaveBeenCalledTimes(1);
      const jobs = queueAddBulk.mock.calls[0][0];
      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toMatchObject({
        name: IngestionJob.BACKFILL_PERSON_CREDITS_ITEM,
        data: { mediaItemId: 'media-1' },
      });
      expect(jobs[0].opts.jobId).toContain('backfill-person-credits_media-1_');
    });

    it('does not queue anything when there are no candidates', async () => {
      await setup([[]]);
      await pipeline.dispatch();
      expect(queueAddBulk).not.toHaveBeenCalled();
    });
  });

  describe('processItem', () => {
    it('loads the credits row and forwards it to the writer', async () => {
      const credits = {
        cast: [{ tmdbId: 1, name: 'A', character: 'X', profilePath: null, order: 0 }],
        crew: [],
      };
      await setup([[{ credits }]]);

      await pipeline.processItem('media-1', 'job-1');

      expect(writeFromCredits).toHaveBeenCalledWith('media-1', credits);
    });

    it('is a no-op when the media item is missing', async () => {
      await setup([[]]);
      await pipeline.processItem('missing', 'job-2');
      expect(writeFromCredits).not.toHaveBeenCalled();
    });
  });
});
