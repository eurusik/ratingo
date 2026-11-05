import { Inject, Injectable } from '@nestjs/common';

import { JOB_STATUS } from '../../../../common/enums/job-status.enum';
import {
  INGESTION_JOB_STATUS_PORT,
  type IngestionJobStatus,
  type IngestionJobStatusPort,
} from '../../domain/ports/ingestion-job-status.port';

import { SyncMediaService } from './sync-media.service';

export interface IngestionJobStatusWithSlug extends IngestionJobStatus {
  slug: string | null;
}

@Injectable()
export class IngestionJobStatusService {
  constructor(
    @Inject(INGESTION_JOB_STATUS_PORT)
    private readonly jobStatusPort: IngestionJobStatusPort,
    private readonly syncService: SyncMediaService,
  ) {}

  async getJobStatus(jobId: string): Promise<IngestionJobStatusWithSlug | null> {
    const job = await this.jobStatusPort.getJobStatus(jobId);
    if (!job) {
      return null;
    }

    return { ...job, slug: await this.resolveSlug(job) };
  }

  private async resolveSlug(job: IngestionJobStatus): Promise<string | null> {
    if (job.status !== JOB_STATUS.READY || !job.tmdbId) {
      return null;
    }
    return this.syncService.getSlugByTmdbId(job.tmdbId, job.mediaType);
  }
}
