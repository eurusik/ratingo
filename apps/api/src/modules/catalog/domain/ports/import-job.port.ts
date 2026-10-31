import { JobStatus } from '@/common/enums/job-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Result of queuing an import job.
 */
export interface QueuedJob {
  jobId: string;
  /** True when an in-flight job with the same id already existed and no new job was enqueued. */
  deduplicated?: boolean;
}

/**
 * Result of checking job status.
 */
export interface JobStatusResult {
  status: JobStatus;
  errorMessage: string | null;
  tmdbId: number | null;
  /** Media type encoded in the import job id (TMDB movie/TV id spaces overlap) */
  type: MediaType;
}

/**
 * Port for import job queue operations.
 * Decouples application layer from BullMQ infrastructure.
 */
export interface IImportJobPort {
  /**
   * Queues a media import job. Deduplicates by type+tmdbId.
   */
  queueImport(tmdbId: number, type: MediaType): Promise<QueuedJob>;

  /**
   * Checks if an import job exists for given media.
   * Returns job ID if active job exists, null otherwise.
   */
  hasActiveJob(tmdbId: number, type: MediaType): Promise<string | null>;

  /**
   * Gets job status by job ID.
   * Returns null if job doesn't exist.
   */
  getJobStatus(jobId: string): Promise<JobStatusResult | null>;

  /**
   * Validates if a job ID is a valid import job format.
   */
  isValidImportJobId(jobId: string): boolean;
}

/**
 * Injection token for the import job port.
 */
export const IMPORT_JOB_PORT = Symbol('IMPORT_JOB_PORT');
