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
  constructor(readonly reason: string) {
    super(`job_failures is unavailable: ${reason}`);
    this.name = 'JobFailuresUnavailableError';
  }
}

export class JobFailuresNotConfiguredError extends JobFailuresUnavailableError {
  constructor() {
    super('AI_READER_DATABASE_URL is not set');
    this.name = 'JobFailuresNotConfiguredError';
  }
}
