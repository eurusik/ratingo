import { type Meter } from '@opentelemetry/api';
import { type Job } from 'bullmq';

import { SCHEDULED_JOBS } from './scheduled-jobs.catalog';
import {
  MS_PER_SECOND,
  SCHEDULER_KEY_SEPARATOR,
  SCHEDULER_RUN_KEY_SEPARATOR,
  SCHEDULER_LAST_RUN_METRIC,
  type SchedulerRunResult,
} from './telemetry.constants';

export const scheduledJobNames = (): ReadonlySet<string> =>
  new Set(SCHEDULED_JOBS.map((job) => job.jobId));

export class SchedulerLastRunGauge {
  private readonly lastRunSeconds = new Map<
    string,
    { jobName: string; result: SchedulerRunResult; seconds: number }
  >();
  private readonly allowedJobNames = scheduledJobNames();

  register(meter: Meter): void {
    meter
      .createObservableGauge(SCHEDULER_LAST_RUN_METRIC, {
        description:
          'Unix time of the last finished run of each scheduled job, by result; absent until the job has run since this process started',
        unit: 's',
      })
      .addCallback((observation) => {
        for (const { jobName, result, seconds } of this.lastRunSeconds.values()) {
          observation.observe(seconds, { job_name: jobName, result });
        }
      });
  }

  record(job: Job, result: SchedulerRunResult): void {
    const jobName = this.toJobName(job.repeatJobKey);
    if (!jobName) return;
    const finishedAt = job.finishedOn ?? Date.now();
    this.lastRunSeconds.set(`${jobName}${SCHEDULER_RUN_KEY_SEPARATOR}${result}`, {
      jobName,
      result,
      seconds: finishedAt / MS_PER_SECOND,
    });
  }

  private toJobName(repeatJobKey: string | undefined): string | undefined {
    if (!repeatJobKey) return undefined;
    const separatorIndex = repeatJobKey.indexOf(SCHEDULER_KEY_SEPARATOR);
    if (separatorIndex < 0) return undefined;
    const jobName = repeatJobKey.slice(separatorIndex + 1);
    return this.allowedJobNames.has(jobName) ? jobName : undefined;
  }
}
