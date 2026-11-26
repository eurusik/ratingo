import { DigestBlock } from '../constants/digest-block.constants';
import { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, RuleOutcome } from '../entities/digest';
import { FactUnit } from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import { measured } from '../entities/measured';
import type { SchedulerJobStat } from '../entities/snapshot';
import { factOf, itemOf } from './rule-helpers';

const isFailing = (job: SchedulerJobStat): boolean =>
  job.lastFailureAgeHours !== null &&
  (job.lastSuccessAgeHours === null || job.lastFailureAgeHours < job.lastSuccessAgeHours);

const dueRunAgeHours = (job: SchedulerJobStat, graceHours: number): number | null => {
  if (job.lastPlannedRunAgeHours === null) return null;
  return job.lastPlannedRunAgeHours >= graceHours
    ? job.lastPlannedRunAgeHours
    : job.previousPlannedRunAgeHours;
};

const isStale = (job: SchedulerJobStat, thresholds: DigestThresholds): boolean => {
  if (job.lastSuccessAgeHours === null) return false;
  const dueAge = dueRunAgeHours(job, thresholds.scheduler.runGraceHours);
  if (dueAge !== null) return job.lastSuccessAgeHours > dueAge;
  return job.lastSuccessAgeHours >= thresholds.scheduler.staleHours;
};

const jobItem = (job: SchedulerJobStat, thresholds: DigestThresholds): DigestItem | null => {
  if (isFailing(job)) {
    return itemOf(
      `scheduler-failing:${job.jobName}`,
      DigestBlock.JOBS,
      DigestLevel.ACTION,
      `Планове завдання «${job.jobName}» завершилось помилкою. Подивись логи воркера.`,
    );
  }
  if (isStale(job, thresholds)) {
    return itemOf(
      `scheduler-stale:${job.jobName}`,
      DigestBlock.JOBS,
      DigestLevel.NOTE,
      `Планове завдання «${job.jobName}» не відпрацювало успішно в останній запуск за розкладом.`,
    );
  }
  return null;
};

export const evaluateScheduler = (
  jobs: readonly SchedulerJobStat[],
  thresholds: DigestThresholds,
): RuleOutcome => ({
  items: jobs
    .map((job) => jobItem(job, thresholds))
    .filter((item): item is DigestItem => item !== null),
  facts: [factOf('планових завдань під наглядом', FactUnit.COUNT, measured(jobs.length))],
});
