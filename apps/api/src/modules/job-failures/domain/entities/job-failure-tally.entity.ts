import { type JobFailureClass } from '../constants/job-failure-class.constants';

export interface JobFailureTally {
  readonly day: string;
  readonly queue: string;
  readonly jobType: string;
  readonly schedulerJobId: string | null;
  readonly errorClass: JobFailureClass;
  readonly failureCount: number;
  readonly exhaustedCount: number;
  readonly firstFailedAtMs: number;
  readonly lastFailedAtMs: number;
  readonly lastMessage: string;
}
