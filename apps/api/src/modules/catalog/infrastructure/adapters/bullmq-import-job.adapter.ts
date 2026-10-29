import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';

import { Job, Queue } from 'bullmq';

import { MediaType } from '@/common/enums/media-type.enum';
import { mapBullStateToJobStatus } from '@/common/infrastructure/bullmq/job-status-mapper';
import { INGESTION_QUEUE, IngestionJob } from '@/modules/ingestion/public';

import { IImportJobPort, JobStatusResult, QueuedJob } from '../../domain/ports/import-job.port';

/**
 * Maps MediaType to corresponding IngestionJob.
 */
const MEDIA_TYPE_TO_JOB: Record<MediaType, IngestionJob> = {
  [MediaType.MOVIE]: IngestionJob.SYNC_MOVIE,
  [MediaType.SHOW]: IngestionJob.SYNC_SHOW,
};

/**
 * BullMQ states in which a job is still pending or running.
 * Completed/failed jobs may be retained in Redis (removeOnComplete/removeOnFail counts)
 * but must not block a new import with the same deterministic jobId.
 */
const ACTIVE_JOB_STATES: ReadonlySet<string> = new Set([
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
]);

/** User-triggered imports jump ahead of batch sync jobs in the queue. */
const IMPORT_JOB_PRIORITY = 1;

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

    // BullMQ ignores queue.add() when a job with the same jobId still exists (even if finished).
    // Drop retained completed/failed jobs first so a re-import is actually enqueued.
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      if (await this.isActive(existing)) {
        return { jobId, deduplicated: true };
      }
      try {
        await existing.remove();
      } catch {
        // Job was locked/picked up concurrently - it is still in flight, so don't re-add.
        return { jobId, deduplicated: true };
      }
    }

    const job = await this.queue.add(jobName, { tmdbId }, { jobId, priority: IMPORT_JOB_PRIORITY });
    return { jobId: job.id!, deduplicated: false };
  }

  async hasActiveJob(tmdbId: number, type: MediaType): Promise<string | null> {
    const jobName = MEDIA_TYPE_TO_JOB[type];
    const jobId = this.buildJobId(jobName, tmdbId);
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    return (await this.isActive(job)) ? jobId : null;
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const status = mapBullStateToJobStatus(state, job.finishedOn);

    return {
      status,
      errorMessage: job.failedReason ?? null,
      tmdbId: job.data?.tmdbId ?? null,
      type: this.parseTypeFromJobId(jobId),
    };
  }

  isValidImportJobId(jobId: string): boolean {
    return (
      jobId.startsWith(`${IngestionJob.SYNC_MOVIE}_`) ||
      jobId.startsWith(`${IngestionJob.SYNC_SHOW}_`)
    );
  }

  private async isActive(job: Job): Promise<boolean> {
    return ACTIVE_JOB_STATES.has(await job.getState());
  }

  /** Import job ids are `${SYNC_MOVIE|SYNC_SHOW}_${tmdbId}` (validated by isValidImportJobId). */
  private parseTypeFromJobId(jobId: string): MediaType {
    return jobId.startsWith(`${IngestionJob.SYNC_SHOW}_`) ? MediaType.SHOW : MediaType.MOVIE;
  }

  private buildJobId(jobName: IngestionJob, tmdbId: number): string {
    return `${jobName}_${tmdbId}`;
  }
}
