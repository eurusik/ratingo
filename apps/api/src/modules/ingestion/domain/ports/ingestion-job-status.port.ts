import { type JobStatus } from '@/common/enums/job-status.enum';
import { type MediaType } from '@/common/enums/media-type.enum';

export const INGESTION_JOB_STATUS_PORT = Symbol('INGESTION_JOB_STATUS_PORT');

export interface IngestionJobStatus {
  id: string;
  status: JobStatus;
  errorMessage: string | null;
  updatedAt: Date | null;
  tmdbId: number | null;
  mediaType: MediaType | undefined;
}

export interface IngestionJobStatusPort {
  getJobStatus(jobId: string): Promise<IngestionJobStatus | null>;
}
