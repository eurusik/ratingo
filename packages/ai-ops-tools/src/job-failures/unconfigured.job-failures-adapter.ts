import {
  JobFailuresNotConfiguredError,
  type JobFailureSummary,
  type JobFailuresPort,
} from './job-failures.port';

export class UnconfiguredJobFailuresAdapter implements JobFailuresPort {
  async since(): Promise<JobFailureSummary[]> {
    throw new JobFailuresNotConfiguredError();
  }
}
