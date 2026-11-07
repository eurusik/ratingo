import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { MediaType } from '@/common/enums/media-type.enum';
import { mapBullStateToJobStatus } from '@/common/infrastructure/bullmq/job-status-mapper';
import {
  type IngestionJobStatus,
  type IngestionJobStatusPort,
} from '@/modules/ingestion/domain/ports/ingestion-job-status.port';
import { INGESTION_QUEUE, IngestionJob } from '@/modules/ingestion/ingestion.constants';

const SYNC_JOB_MEDIA_TYPE: Partial<Record<string, MediaType>> = {
  [IngestionJob.SYNC_MOVIE]: MediaType.MOVIE,
  [IngestionJob.SYNC_SHOW]: MediaType.SHOW,
};

@Injectable()
export class BullMqIngestionJobStatusAdapter implements IngestionJobStatusPort {
  constructor(@InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue) {}

  async getJobStatus(jobId: string): Promise<IngestionJobStatus | null> {
    const job = await this.ingestionQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const lastActivityAt = job.finishedOn ?? job.processedOn ?? job.timestamp;

    return {
      id: `${job.id}`,
      status: mapBullStateToJobStatus(state, job.finishedOn),
      errorMessage: job.failedReason || null,
      updatedAt: lastActivityAt ? new Date(lastActivityAt) : null,
      tmdbId: job.data?.tmdbId ?? null,
      mediaType: SYNC_JOB_MEDIA_TYPE[job.name],
    };
  }
}
