import { Test, TestingModule } from '@nestjs/testing';

import { type Job } from 'bullmq';

import { MediaType } from '@/common/enums/media-type.enum';

import { IngestionJob } from '../../ingestion.constants';
import { BackfillMdblistRatingsPipeline } from '../pipelines/backfill-mdblist-ratings.pipeline';

import { RatingsBackfillWorker, isValidMdblistItemPayload } from './ratings-backfill.worker';

describe('isValidMdblistItemPayload', () => {
  const valid = { mediaItemId: 'media-1', tmdbId: 101, type: MediaType.MOVIE };

  it('accepts a well-formed payload', () => {
    expect(isValidMdblistItemPayload(valid)).toBe(true);
    expect(isValidMdblistItemPayload({ ...valid, type: MediaType.SHOW })).toBe(true);
  });

  it('rejects null / undefined / primitives', () => {
    expect(isValidMdblistItemPayload(null)).toBe(false);
    expect(isValidMdblistItemPayload(undefined)).toBe(false);
    expect(isValidMdblistItemPayload('string')).toBe(false);
    expect(isValidMdblistItemPayload(42)).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(isValidMdblistItemPayload({ tmdbId: 1, type: MediaType.MOVIE })).toBe(false);
    expect(isValidMdblistItemPayload({ mediaItemId: 'x', type: MediaType.MOVIE })).toBe(false);
    expect(isValidMdblistItemPayload({ mediaItemId: 'x', tmdbId: 1 })).toBe(false);
  });

  it('rejects wrong field types', () => {
    expect(isValidMdblistItemPayload({ ...valid, mediaItemId: 42 })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, mediaItemId: '' })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, tmdbId: '101' })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, tmdbId: 0 })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, tmdbId: -1 })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, tmdbId: 1.5 })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, tmdbId: NaN })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, type: 'invalid' })).toBe(false);
    expect(isValidMdblistItemPayload({ ...valid, type: null })).toBe(false);
  });
});

describe('RatingsBackfillWorker', () => {
  let worker: RatingsBackfillWorker;
  let pipeline: { processItem: jest.Mock };

  beforeEach(async () => {
    pipeline = { processItem: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsBackfillWorker,
        { provide: BackfillMdblistRatingsPipeline, useValue: pipeline },
      ],
    }).compile();

    worker = module.get(RatingsBackfillWorker);
  });

  const buildJob = (data: unknown, name: string = IngestionJob.BACKFILL_MDBLIST_RATINGS_ITEM) =>
    ({ id: 'job-1', name, data }) as unknown as Job;

  it('delegates valid payload to the pipeline', async () => {
    const payload = { mediaItemId: 'media-1', tmdbId: 101, type: MediaType.MOVIE };
    await worker.process(buildJob(payload));

    expect(pipeline.processItem).toHaveBeenCalledWith(payload);
  });

  it('drops a malformed payload without throwing (prevents 3× BullMQ retry noise)', async () => {
    await expect(
      worker.process(buildJob({ mediaItemId: '', tmdbId: 'bad', type: 'movie' })),
    ).resolves.not.toThrow();

    expect(pipeline.processItem).not.toHaveBeenCalled();
  });

  it('drops a null payload without throwing', async () => {
    await expect(worker.process(buildJob(null))).resolves.not.toThrow();

    expect(pipeline.processItem).not.toHaveBeenCalled();
  });

  it('ignores unknown job types (logs warn, does not throw)', async () => {
    await expect(
      worker.process(
        buildJob(
          { mediaItemId: 'media-1', tmdbId: 101, type: MediaType.MOVIE },
          'some-unrelated-job',
        ),
      ),
    ).resolves.not.toThrow();

    expect(pipeline.processItem).not.toHaveBeenCalled();
  });

  it('rethrows downstream errors so BullMQ can retry', async () => {
    pipeline.processItem.mockRejectedValue(new Error('DB outage'));

    await expect(
      worker.process(buildJob({ mediaItemId: 'media-1', tmdbId: 101, type: MediaType.MOVIE })),
    ).rejects.toThrow('DB outage');
  });
});
