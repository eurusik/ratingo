import { Inject, Injectable, Logger } from '@nestjs/common';

import { DatabaseException } from '@/common/exceptions/database.exception';
import { errorMessage } from '@/common/utils/error.utils';
import { type JobFailure } from '@/modules/job-failures/domain/entities/job-failure.entity';
import { classifyJobFailure } from '@/modules/job-failures/domain/policies/classify-job-failure.policy';
import { redactFailureMessage } from '@/modules/job-failures/domain/policies/failure-message.policy';
import {
  isRetentionDue,
  retentionCutoffMs,
} from '@/modules/job-failures/domain/policies/retention.policy';
import {
  JOB_FAILURE_SUMMARY_REPOSITORY,
  type JobFailureSummaryRepository,
} from '@/modules/job-failures/domain/repositories/job-failure-summary.repository';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

import { toFailureSignal } from '../mappers/failure-signal.mapper';

export interface FailedJobReport {
  readonly queue: string;
  readonly jobType: string;
  readonly schedulerJobId: string | null;
  readonly attemptsExhausted: boolean;
  readonly failedAtMs: number | undefined;
  readonly error: unknown;
}

@Injectable()
export class JobFailureRecorder {
  private readonly logger = new Logger(JobFailureRecorder.name);
  private lastPrunedAtMs: number | null = null;

  constructor(
    @Inject(JOB_FAILURE_SUMMARY_REPOSITORY)
    private readonly repository: JobFailureSummaryRepository,
    @Inject(CLOCK_PORT) private readonly clock: IClockPort,
  ) {}

  async record(report: FailedJobReport): Promise<void> {
    const nowMs = this.clock.now().getTime();
    try {
      await this.repository.recordFailure(this.toJobFailure(report, nowMs));
    } catch (error) {
      this.warnUnlessLogged(
        error,
        `Failure of ${report.queue}/${report.jobType} not recorded: ${errorMessage(error)}`,
      );
      return;
    }
    await this.pruneWhenDue(nowMs);
  }

  private toJobFailure(report: FailedJobReport, nowMs: number): JobFailure {
    const signal = toFailureSignal(report.error);
    return {
      queue: report.queue,
      jobType: report.jobType,
      schedulerJobId: report.schedulerJobId,
      errorClass: classifyJobFailure(signal),
      attemptsExhausted: report.attemptsExhausted,
      failedAt: new Date(report.failedAtMs ?? nowMs),
      message: redactFailureMessage(signal.message),
    };
  }

  private async pruneWhenDue(nowMs: number): Promise<void> {
    if (!isRetentionDue(this.lastPrunedAtMs, nowMs)) return;
    this.lastPrunedAtMs = nowMs;
    try {
      const deleted = await this.repository.deleteDaysBefore(new Date(retentionCutoffMs(nowMs)));
      if (deleted > 0) this.logger.log(`Pruned ${deleted} job failure day rows`);
    } catch (error) {
      this.warnUnlessLogged(error, `Old job failure days not pruned: ${errorMessage(error)}`);
    }
  }

  private warnUnlessLogged(error: unknown, message: string): void {
    if (error instanceof DatabaseException) return;
    this.logger.warn(message);
  }
}
