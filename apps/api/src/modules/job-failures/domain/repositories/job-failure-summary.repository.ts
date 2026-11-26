import { type JobFailure } from '../entities/job-failure.entity';

export const JOB_FAILURE_SUMMARY_REPOSITORY = Symbol('JOB_FAILURE_SUMMARY_REPOSITORY');

export interface JobFailureSummaryRepository {
  recordFailure(failure: JobFailure): Promise<void>;
  deleteDaysBefore(cutoff: Date): Promise<number>;
}
