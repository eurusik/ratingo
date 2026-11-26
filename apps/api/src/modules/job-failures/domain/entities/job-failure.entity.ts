import { type JobFailureClass } from '../constants/job-failure-class.constants';

export interface JobFailure {
  readonly queue: string;
  readonly jobType: string;
  readonly schedulerJobId: string | null;
  readonly errorClass: JobFailureClass;
  readonly attemptsExhausted: boolean;
  readonly failedAt: Date;
  readonly message: string;
}
