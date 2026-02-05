/**
 * Public job status for API responses.
 * Maps internal BullMQ states to user-friendly statuses.
 */
export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

/** For Swagger @ApiProperty({ enum: JOB_STATUS_VALUES }) */
export const JOB_STATUS_VALUES: JobStatus[] = Object.values(JOB_STATUS);
