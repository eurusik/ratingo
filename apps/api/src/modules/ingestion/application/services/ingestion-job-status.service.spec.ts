import { JOB_STATUS } from '../../../../common/enums/job-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { type IngestionJobStatus } from '../../domain/ports/ingestion-job-status.port';

import { IngestionJobStatusService } from './ingestion-job-status.service';
import { type SyncMediaService } from './sync-media.service';

describe('IngestionJobStatusService', () => {
  const makeStatus = (overrides: Partial<IngestionJobStatus> = {}): IngestionJobStatus => ({
    id: 'job-42',
    status: JOB_STATUS.READY,
    errorMessage: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    tmdbId: 550,
    mediaType: MediaType.MOVIE,
    ...overrides,
  });

  const createService = (status: IngestionJobStatus | null) => {
    const jobStatusPort = { getJobStatus: jest.fn().mockResolvedValue(status) };
    const syncService = { getSlugByTmdbId: jest.fn().mockResolvedValue('fight-club') };
    const service = new IngestionJobStatusService(
      jobStatusPort,
      syncService as unknown as SyncMediaService,
    );
    return { service, jobStatusPort, syncService };
  };

  it('returns null when the job does not exist', async () => {
    const { service, syncService } = createService(null);

    await expect(service.getJobStatus('missing')).resolves.toBeNull();
    expect(syncService.getSlugByTmdbId).not.toHaveBeenCalled();
  });

  it('resolves the slug for a ready job using its tmdb id and media type', async () => {
    const { service, syncService } = createService(makeStatus({ mediaType: MediaType.SHOW }));

    const result = await service.getJobStatus('job-42');

    expect(result).toEqual({ ...makeStatus({ mediaType: MediaType.SHOW }), slug: 'fight-club' });
    expect(syncService.getSlugByTmdbId).toHaveBeenCalledWith(550, MediaType.SHOW);
  });

  it('skips the slug lookup when the job is not ready', async () => {
    const { service, syncService } = createService(makeStatus({ status: JOB_STATUS.PROCESSING }));

    const result = await service.getJobStatus('job-42');

    expect(result?.slug).toBeNull();
    expect(syncService.getSlugByTmdbId).not.toHaveBeenCalled();
  });

  it('skips the slug lookup when the job has no tmdb id', async () => {
    const { service, syncService } = createService(makeStatus({ tmdbId: null }));

    const result = await service.getJobStatus('job-42');

    expect(result?.slug).toBeNull();
    expect(syncService.getSlugByTmdbId).not.toHaveBeenCalled();
  });
});
