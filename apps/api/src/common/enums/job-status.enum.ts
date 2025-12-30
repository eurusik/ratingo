/**
 * Public job status for API responses.
 * Maps internal BullMQ states to user-friendly statuses.
 */
export enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

/**
 * Mapping from BullMQ internal states to public JobStatus.
 */
export const BULL_STATE_TO_JOB_STATUS: Record<string, JobStatus> = {
  waiting: JobStatus.QUEUED,
  delayed: JobStatus.QUEUED,
  active: JobStatus.PROCESSING,
  completed: JobStatus.READY,
  failed: JobStatus.FAILED,
  paused: JobStatus.QUEUED,
  stalled: JobStatus.FAILED,
};
