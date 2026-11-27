export interface JobFailureFilter {
  firstKyivDay: string;
  lastKyivDay: string;
  job?: string;
  queue?: string;
}

export interface JobFailureSummary {
  job: string;
  jobType: string;
  queue: string;
  errorClass: string;
  failures: number;
  attemptsExhausted: number;
  firstFailedAtMs: number;
  lastFailedAtMs: number;
  lastMessage: string;
}

export interface JobFailuresPort {
  since(filter: JobFailureFilter): Promise<JobFailureSummary[]>;
}

export class JobFailuresUnavailableError extends Error {
  constructor(reason: string) {
    super(`job_failures is unavailable: ${reason}`);
    this.name = 'JobFailuresUnavailableError';
  }
}
