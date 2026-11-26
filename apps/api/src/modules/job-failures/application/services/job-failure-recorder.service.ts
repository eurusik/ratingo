import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';

import { DatabaseException } from '@/common/exceptions/database.exception';
import { errorMessage } from '@/common/utils/error.utils';
import { withTimeout } from '@/common/utils/with-timeout.util';
import { JOB_FAILURE_RETENTION_DAYS } from '@/modules/job-failures/domain/constants/job-failure.constants';
import { type JobFailure } from '@/modules/job-failures/domain/entities/job-failure.entity';
import { classifyJobFailure } from '@/modules/job-failures/domain/policies/classify-job-failure.policy';
import { redactFailureMessage } from '@/modules/job-failures/domain/policies/failure-message.policy';
import { failuresIn } from '@/modules/job-failures/domain/policies/job-failure-tally.policy';
import { kyivDayOf } from '@/modules/job-failures/domain/policies/kyiv-day.policy';
import { isRetentionDue } from '@/modules/job-failures/domain/policies/retention.policy';
import {
  JOB_FAILURE_SUMMARY_REPOSITORY,
  type JobFailureSummaryRepository,
} from '@/modules/job-failures/domain/repositories/job-failure-summary.repository';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

import {
  JOB_FAILURE_BATCH_MAX_ROWS,
  JOB_FAILURE_FLUSH_INTERVAL_MS,
  JOB_FAILURE_SHUTDOWN_FLUSH_TIMEOUT_MS,
} from '../job-failure-recording.constants';
import { toFailureSignal } from '../mappers/failure-signal.mapper';

import { JobFailureBatch } from './job-failure-batch';

export interface FailedJobReport {
  readonly queue: string;
  readonly jobType: string;
  readonly schedulerJobId: string | null;
  readonly attemptsExhausted: boolean;
  readonly failedAtMs: number | undefined;
  readonly error: unknown;
}

@Injectable()
export class JobFailureRecorder implements OnApplicationShutdown {
  private readonly logger = new Logger(JobFailureRecorder.name);
  private readonly batch = new JobFailureBatch(JOB_FAILURE_BATCH_MAX_ROWS);
  private flushTimer: NodeJS.Timeout | null = null;
  private flushes: Promise<void> = Promise.resolve();
  private lastPrunedAtMs: number | null = null;

  constructor(
    @Inject(JOB_FAILURE_SUMMARY_REPOSITORY)
    private readonly repository: JobFailureSummaryRepository,
    @Inject(CLOCK_PORT) private readonly clock: IClockPort,
  ) {}

  record(report: FailedJobReport): void {
    try {
      this.batch.add(this.toJobFailure(report));
      this.scheduleFlush();
    } catch (error) {
      this.logger.warn(
        `Failure of ${report.queue}/${report.jobType} not counted: ${errorMessage(error)}`,
      );
    }
  }

  flush(): Promise<void> {
    this.flushes = this.flushes
      .then(() => this.writePending())
      .catch((error: unknown) => {
        this.logger.warn(`Job failure flush failed: ${errorMessage(error)}`);
      });
    return this.flushes;
  }

  async onApplicationShutdown(): Promise<void> {
    this.cancelScheduledFlush();
    try {
      await withTimeout(
        this.flush(),
        JOB_FAILURE_SHUTDOWN_FLUSH_TIMEOUT_MS,
        `job failure flush exceeded ${JOB_FAILURE_SHUTDOWN_FLUSH_TIMEOUT_MS}ms`,
      );
    } catch (error) {
      this.logger.warn(`Job failures lost on shutdown: ${errorMessage(error)}`);
    }
  }

  private toJobFailure(report: FailedJobReport): JobFailure {
    const signal = toFailureSignal(report.error);
    const failedAtMs = report.failedAtMs ?? this.clock.now().getTime();
    return {
      day: kyivDayOf(failedAtMs),
      queue: report.queue,
      jobType: report.jobType,
      schedulerJobId: report.schedulerJobId,
      errorClass: classifyJobFailure(signal),
      attemptsExhausted: report.attemptsExhausted,
      failedAtMs,
      message: redactFailureMessage(signal.message),
    };
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, JOB_FAILURE_FLUSH_INTERVAL_MS);
    this.flushTimer.unref();
  }

  private cancelScheduledFlush(): void {
    if (this.flushTimer === null) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private async writePending(): Promise<void> {
    const { tallies, droppedFailures } = this.batch.drain();
    this.reportDropped(droppedFailures);
    if (tallies.length === 0) return;
    try {
      await this.repository.addTallies(tallies);
    } catch (error) {
      this.warnUnlessLogged(
        error,
        `${failuresIn(tallies)} job failures in ${tallies.length} rows not recorded: ${errorMessage(error)}`,
      );
      return;
    }
    await this.pruneWhenDue();
  }

  private reportDropped(droppedFailures: number): void {
    if (droppedFailures === 0) return;
    this.logger.warn(
      `${droppedFailures} job failures not counted: more than ${JOB_FAILURE_BATCH_MAX_ROWS} rows waited for one flush`,
    );
  }

  private async pruneWhenDue(): Promise<void> {
    const nowMs = this.clock.now().getTime();
    if (!isRetentionDue(this.lastPrunedAtMs, nowMs)) return;
    this.lastPrunedAtMs = nowMs;
    try {
      const deleted = await this.repository.deleteDaysOlderThan(
        kyivDayOf(nowMs),
        JOB_FAILURE_RETENTION_DAYS,
      );
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
