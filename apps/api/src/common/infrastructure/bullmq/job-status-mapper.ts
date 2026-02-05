import { JOB_STATUS, type JobStatus } from '@/common/enums/job-status.enum';

/**
 * Maps BullMQ internal states to public JobStatus.
 * Infrastructure concern - only used by BullMQ adapters/controllers.
 */
const BULL_STATE_TO_JOB_STATUS: Record<string, JobStatus> = {
  waiting: JOB_STATUS.QUEUED,
  prioritized: JOB_STATUS.QUEUED,
  delayed: JOB_STATUS.QUEUED,
  active: JOB_STATUS.PROCESSING,
  completed: JOB_STATUS.READY,
  failed: JOB_STATUS.FAILED,
  paused: JOB_STATUS.QUEUED,
  stalled: JOB_STATUS.FAILED,
};

/**
 * Maps BullMQ job state to public JobStatus.
 * Handles unknown states by inferring from finishedOn timestamp.
 */
export function mapBullStateToJobStatus(state: string, finishedOn?: number | null): JobStatus {
  const mapped = BULL_STATE_TO_JOB_STATUS[state];
  if (mapped) return mapped;

  // Unknown state: infer from finishedOn timestamp
  return finishedOn ? JOB_STATUS.READY : JOB_STATUS.FAILED;
}
