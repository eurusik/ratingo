import { RowList, type ClockPort } from '@ratingo/ai-core';

import { isJobNameFilter, isQueueName, parseWindow } from '../shared/metric-params.policy';
import { InvalidOpsInputError } from '../shared/invalid-ops-input.error';
import { kyivDateOf } from '../time/kyiv-day';
import { formatKyivDateTime } from '../time/kyiv-time';

import { JOB_FAILURES_DEFAULT_WINDOW } from './job-failures.constants';
import type { JobFailuresInput } from './job-failures.input';
import type { JobFailureSummary, JobFailuresPort } from './job-failures.port';

const MS_PER_HOUR = 3_600_000;

const byFailuresThenRecency = (left: JobFailureSummary, right: JobFailureSummary): number =>
  right.failures - left.failures || right.lastFailedAtMs - left.lastFailedAtMs;

const toRow = (summary: JobFailureSummary) => ({
  job: summary.job,
  ...(summary.jobType !== summary.job ? { jobType: summary.jobType } : {}),
  queue: summary.queue,
  errorClass: summary.errorClass,
  failuresOnThoseDays: summary.failures,
  attemptsExhaustedOnThoseDays: summary.attemptsExhausted,
  firstFailedAtKyiv: formatKyivDateTime(summary.firstFailedAtMs),
  lastFailedAtKyiv: formatKyivDateTime(summary.lastFailedAtMs),
  lastMessage: summary.lastMessage,
});

const HANDLED_ERRORS_SENTENCE =
  'Errors that a job catches, logs and continues past, such as one show failing inside a batch, are never recorded here; they appear only in logs_search.';

export const nothingRecordedNote = (filter: { job?: string; queue?: string }): string => {
  const subject =
    filter.job === undefined && filter.queue === undefined
      ? 'No failed job attempt was recorded'
      : 'No failed job attempt matching this filter was recorded';
  return `${subject} on those days. ${HANDLED_ERRORS_SENTENCE}`;
};

const hintFor = (input: JobFailuresInput): string =>
  input.job === undefined && input.queue === undefined
    ? 'pass job=<part of a job name> or queue=<queue name> or a shorter window'
    : 'pass a shorter window or a more specific job';

export class JobFailuresExecutor {
  constructor(
    private readonly failures: JobFailuresPort,
    private readonly clock: ClockPort,
  ) {}

  async run(input: JobFailuresInput): Promise<unknown> {
    const window = parseWindow(input.window ?? JOB_FAILURES_DEFAULT_WINDOW);
    if (window === null) {
      throw new InvalidOpsInputError('window must look like 24h or 7d and be at most 7 days');
    }
    if (input.job !== undefined && !isJobNameFilter(input.job)) {
      throw new InvalidOpsInputError('job must be part of a job name such as sync-show');
    }
    if (input.queue !== undefined && !isQueueName(input.queue)) {
      throw new InvalidOpsInputError('invalid queue name');
    }
    const nowMs = this.clock.nowMs();
    const countedKyivDays = {
      from: kyivDateOf(nowMs - window.hours * MS_PER_HOUR),
      to: kyivDateOf(nowMs),
    };
    const summaries = await this.failures.since({
      firstKyivDay: countedKyivDays.from,
      lastKyivDay: countedKyivDays.to,
      job: input.job,
      queue: input.queue,
    });
    const rows = [...summaries].sort(byFailuresThenRecency).map(toRow);
    return RowList.of(rows, hintFor(input), (kept, omission) => ({
      window: window.promql,
      countedKyivDays,
      ...(input.job !== undefined ? { job: input.job } : {}),
      ...(input.queue !== undefined ? { queue: input.queue } : {}),
      failures: kept,
      ...(rows.length === 0 ? { note: nothingRecordedNote(input) } : {}),
      ...omission,
    }));
  }
}
