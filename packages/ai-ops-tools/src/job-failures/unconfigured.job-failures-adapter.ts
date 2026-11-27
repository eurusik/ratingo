import {
  JobFailuresUnavailableError,
  type JobFailureSummary,
  type JobFailuresPort,
} from './job-failures.port';

export class UnconfiguredJobFailuresAdapter implements JobFailuresPort {
  async since(): Promise<JobFailureSummary[]> {
    throw new JobFailuresUnavailableError('AI_READER_DATABASE_URL is not set');
  }
}
