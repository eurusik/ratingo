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

const jobItem = (job: SchedulerJobStat, thresholds: DigestThresholds): DigestItem | null => {
  if (isFailing(job)) {
    return itemOf(
      `scheduler-failing:${job.jobName}`,
      DigestBlock.JOBS,
      DigestLevel.ACTION,
      `Нічне завдання «${job.jobName}» завершилось помилкою. Подивись логи воркера.`,
    );
  }
  if (
    job.lastSuccessAgeHours !== null &&
    job.lastSuccessAgeHours >= thresholds.scheduler.staleHours
  ) {
    return itemOf(
      `scheduler-stale:${job.jobName}`,
      DigestBlock.JOBS,
      DigestLevel.NOTE,
      `Нічне завдання «${job.jobName}» давно не запускалось успішно.`,
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
  facts: [
    factOf('нічних завдань за розкладом під наглядом', FactUnit.COUNT, measured(jobs.length)),
  ],
});
