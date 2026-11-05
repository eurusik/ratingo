import { MediaType } from '../../../../../common/enums/media-type.enum';
import { IngestionJob } from '../../../ingestion.constants';

import { BullMqIngestionJobStatusAdapter } from './bullmq-ingestion-job-status.adapter';

describe('BullMqIngestionJobStatusAdapter', () => {
  const makeJob = (state: string, overrides: Record<string, unknown> = {}) => ({
    id: 42,
    name: IngestionJob.SYNC_MOVIE,
    getState: jest.fn().mockResolvedValue(state),
    failedReason: undefined,
    finishedOn: undefined,
    processedOn: undefined,
    timestamp: undefined,
    data: {},
    ...overrides,
  });

  const createAdapter = (job: unknown) => {
    const queue = { getJob: jest.fn().mockResolvedValue(job) };
    return { adapter: new BullMqIngestionJobStatusAdapter(queue as never), queue };
  };

  it('returns null when the job does not exist', async () => {
    const { adapter, queue } = createAdapter(null);

    await expect(adapter.getJobStatus('missing')).resolves.toBeNull();
    expect(queue.getJob).toHaveBeenCalledWith('missing');
  });

  it('maps a completed movie job with its tmdb id and finish time', async () => {
    const finishedOn = Date.UTC(2026, 0, 1);
    const { adapter } = createAdapter(makeJob('completed', { finishedOn, data: { tmdbId: 550 } }));

    await expect(adapter.getJobStatus('42')).resolves.toEqual({
      id: '42',
      status: 'ready',
      errorMessage: null,
      updatedAt: new Date(finishedOn),
      tmdbId: 550,
      mediaType: MediaType.MOVIE,
    });
  });

  it('falls back to processedOn then timestamp for updatedAt', async () => {
    const processedOn = Date.UTC(2026, 0, 2);
    const timestamp = Date.UTC(2026, 0, 3);

    const processing = await createAdapter(
      makeJob('active', { processedOn, timestamp }),
    ).adapter.getJobStatus('42');
    const queued = await createAdapter(makeJob('waiting', { timestamp })).adapter.getJobStatus(
      '42',
    );

    expect(processing?.updatedAt).toEqual(new Date(processedOn));
    expect(queued?.updatedAt).toEqual(new Date(timestamp));
  });

  it('returns null updatedAt, tmdbId and mediaType when the job carries none', async () => {
    const { adapter } = createAdapter(makeJob('waiting', { name: 'unknown-job' }));

    const result = await adapter.getJobStatus('42');

    expect(result).toMatchObject({ updatedAt: null, tmdbId: null, mediaType: undefined });
  });

  it('derives the show media type and surfaces the failure reason', async () => {
    const { adapter } = createAdapter(
      makeJob('failed', { name: IngestionJob.SYNC_SHOW, failedReason: 'boom' }),
    );

    const result = await adapter.getJobStatus('42');

    expect(result).toMatchObject({
      status: 'failed',
      errorMessage: 'boom',
      mediaType: MediaType.SHOW,
    });
  });
});
