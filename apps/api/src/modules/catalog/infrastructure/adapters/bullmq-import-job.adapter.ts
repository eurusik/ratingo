import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';

import { Queue } from 'bullmq';

import { BULL_STATE_TO_JOB_STATUS, JobStatus } from '@/common/enums/job-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';
import { INGESTION_QUEUE, IngestionJob } from '@/modules/ingestion/ingestion.constants';

import { IImportJobPort, JobStatusResult, QueuedJob } from '../../domain/ports/import-job.port';

/**
 * Maps MediaType to corresponding IngestionJob.
 */
const MEDIA_TYPE_TO_JOB: Record<MediaType, IngestionJob> = {
  [MediaType.MOVIE]: IngestionJob.SYNC_MOVIE,
  [MediaType.SHOW]: IngestionJob.SYNC_SHOW,
};

/**
 * BullMQ implementation of IImportJobPort.
 * Encapsulates all BullMQ-specific logic for import job operations.
 */
@Injectable()
export class BullMQImportJobAdapter implements IImportJobPort {
  constructor(
    @InjectQueue(INGESTION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async queueImport(tmdbId: number, type: MediaType): Promise<QueuedJob> {
    const jobName = MEDIA_TYPE_TO_JOB[type];
    const jobId = this.buildJobId(jobName, tmdbId);
    const job = await this.queue.add(jobName, { tmdbId }, { jobId });
    return { jobId: job.id! };
  }

  async hasActiveJob(tmdbId: number, type: MediaType): Promise<string | null> {
    const jobName = MEDIA_TYPE_TO_JOB[type];
    const jobId = this.buildJobId(jobName, tmdbId);
    const job = await this.queue.getJob(jobId);
    return job ? jobId : null;
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const status =
      BULL_STATE_TO_JOB_STATUS[state] ??
      BULL_STATE_TO_JOB_STATUS[job.finishedOn ? 'completed' : 'failed'] ??
      JobStatus.FAILED;

    return {
      status,
      errorMessage: job.failedReason ?? null,
      tmdbId: job.data?.tmdbId ?? null,
    };
  }

  isValidImportJobId(jobId: string): boolean {
    return (
      jobId.startsWith(`${IngestionJob.SYNC_MOVIE}_`) ||
      jobId.startsWith(`${IngestionJob.SYNC_SHOW}_`)
    );
  }

  private buildJobId(jobName: IngestionJob, tmdbId: number): string {
    return `${jobName}_${tmdbId}`;
  }
}
