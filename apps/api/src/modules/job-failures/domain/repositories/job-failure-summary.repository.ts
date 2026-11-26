import { type JobFailureTally } from '../entities/job-failure-tally.entity';

export const JOB_FAILURE_SUMMARY_REPOSITORY = Symbol('JOB_FAILURE_SUMMARY_REPOSITORY');

export interface JobFailureSummaryRepository {
  addTallies(tallies: readonly JobFailureTally[]): Promise<void>;
  deleteDaysOlderThan(kyivToday: string, keptDays: number): Promise<number>;
}
