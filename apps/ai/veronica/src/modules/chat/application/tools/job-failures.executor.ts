import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, RowList, type ClockPort } from '@ratingo/ai-core';

import { formatKyivDateTime } from '../../domain/policies/kyiv-time.policy';
import {
  isJobNameFilter,
  isQueueName,
  parseWindow,
} from '../../domain/policies/metric-params.policy';
import {
  JOB_FAILURES_PORT,
  type JobFailureSummary,
  type JobFailuresPort,
} from '../../domain/ports/job-failures.port';

import type { JobFailuresInput } from './investigation-executors';

const MS_PER_HOUR = 3_600_000;
const DEFAULT_FAILURES_WINDOW = '24h';

const byFailuresThenRecency = (left: JobFailureSummary, right: JobFailureSummary): number =>
  right.failures - left.failures || right.lastFailedAtMs - left.lastFailedAtMs;

const toRow = (summary: JobFailureSummary) => ({
  job: summary.job,
  ...(summary.jobType !== summary.job ? { jobType: summary.jobType } : {}),
  queue: summary.queue,
  errorClass: summary.errorClass,
  failures: summary.failures,
  attemptsExhausted: summary.attemptsExhausted,
  firstFailedAtKyiv: formatKyivDateTime(summary.firstFailedAtMs),
  lastFailedAtKyiv: formatKyivDateTime(summary.lastFailedAtMs),
  lastMessage: summary.lastMessage,
});

const hintFor = (input: JobFailuresInput): string =>
  input.job === undefined && input.queue === undefined
    ? 'pass job=<part of a job name> or queue=<queue name> or a shorter window'
    : 'pass a shorter window or a more specific job';

@Injectable()
export class JobFailuresExecutor {
  constructor(
    @Inject(JOB_FAILURES_PORT) private readonly failures: JobFailuresPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async run(input: JobFailuresInput): Promise<unknown> {
    const window = parseWindow(input.window ?? DEFAULT_FAILURES_WINDOW);
    if (window === null) {
      throw new Error('window must look like 24h or 7d and be at most 7 days');
    }
    if (input.job !== undefined && !isJobNameFilter(input.job)) {
      throw new Error('job must be part of a job name such as sync-show');
    }
    if (input.queue !== undefined && !isQueueName(input.queue)) {
      throw new Error('invalid queue name');
    }
    const summaries = await this.failures.since({
      sinceMs: this.clock.nowMs() - window.hours * MS_PER_HOUR,
      job: input.job,
      queue: input.queue,
    });
    const rows = [...summaries].sort(byFailuresThenRecency).map(toRow);
    return RowList.of(rows, hintFor(input), (kept, omission) => ({
      window: window.promql,
      ...(input.job !== undefined ? { job: input.job } : {}),
      ...(input.queue !== undefined ? { queue: input.queue } : {}),
      failures: kept,
      ...omission,
    }));
  }
}
