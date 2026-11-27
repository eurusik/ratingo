import { JOB_FAILURES_ROW_LIMIT } from '../job-failures/job-failures.constants';
import type {
  JobFailureFilter,
  JobFailureSummary,
  JobFailuresPort,
} from '../job-failures/job-failures.port';

export interface SimulatedJobFailureDay {
  day: string;
  schedulerJobId: string | null;
  jobType: string;
  queue: string;
  errorClass: string;
  failures: number;
  exhausted: number;
  firstFailedAtMs: number;
  lastFailedAtMs: number;
  lastMessage: string;
}

const nameOf = (row: SimulatedJobFailureDay): string => row.schedulerJobId ?? row.jobType;

const groupKey = (row: SimulatedJobFailureDay): string =>
  [nameOf(row), row.jobType, row.queue, row.errorClass].join('\u0000');

const matchesFilter = (row: SimulatedJobFailureDay, filter: JobFailureFilter): boolean =>
  row.day >= filter.firstKyivDay &&
  row.day <= filter.lastKyivDay &&
  (filter.job === undefined ||
    row.jobType.includes(filter.job) ||
    (row.schedulerJobId ?? '').includes(filter.job)) &&
  (filter.queue === undefined || row.queue === filter.queue);

const summaryOf = (rows: readonly SimulatedJobFailureDay[]): JobFailureSummary => {
  const newest = rows.reduce((latest, row) =>
    row.lastFailedAtMs > latest.lastFailedAtMs ? row : latest,
  );
  return {
    job: nameOf(newest),
    jobType: newest.jobType,
    queue: newest.queue,
    errorClass: newest.errorClass,
    failures: rows.reduce((sum, row) => sum + row.failures, 0),
    attemptsExhausted: rows.reduce((sum, row) => sum + row.exhausted, 0),
    firstFailedAtMs: Math.min(...rows.map((row) => row.firstFailedAtMs)),
    lastFailedAtMs: newest.lastFailedAtMs,
    lastMessage: newest.lastMessage,
  };
};

const byFailuresThenRecency = (left: JobFailureSummary, right: JobFailureSummary): number =>
  right.failures - left.failures ||
  right.lastFailedAtMs - left.lastFailedAtMs ||
  left.job.localeCompare(right.job);

export const createJobFailuresSimulator = (
  days: readonly SimulatedJobFailureDay[],
): JobFailuresPort => ({
  since: async (filter) => {
    const groups = new Map<string, SimulatedJobFailureDay[]>();
    for (const row of days.filter((candidate) => matchesFilter(candidate, filter))) {
      groups.set(groupKey(row), [...(groups.get(groupKey(row)) ?? []), row]);
    }
    return [...groups.values()]
      .map(summaryOf)
      .sort(byFailuresThenRecency)
      .slice(0, JOB_FAILURES_ROW_LIMIT);
  },
});
