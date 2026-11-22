import { Inject, Injectable } from '@nestjs/common';

import type { SchedulerJobStat } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { METRICS_PORT, type MetricsPort } from '../../domain/ports/metrics.port';

import { guarded, hoursSince } from './collector-helpers';

const LAST_RUNS =
  'max by (job_name, result) (last_over_time(app_scheduler_last_run_timestamp_seconds[3d]))';
const SUCCESS = 'success';
const FAILURE = 'failure';

@Injectable()
export class SchedulerCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<SchedulerJobStat[]>> {
    return guarded(async () => {
      const samples = await this.metrics.instant(LAST_RUNS, nowMs);
      if (samples.length === 0) {
        return unavailable('метрики планувальника ще немає');
      }
      const jobs = new Map<string, SchedulerJobStat>();
      for (const sample of samples) {
        const jobName = sample.labels.job_name ?? 'невідоме';
        const job = jobs.get(jobName) ?? {
          jobName,
          lastSuccessAgeHours: null,
          lastFailureAgeHours: null,
        };
        const age = hoursSince(sample.value, nowMs);
        if (sample.labels.result === SUCCESS) job.lastSuccessAgeHours = age;
        if (sample.labels.result === FAILURE) job.lastFailureAgeHours = age;
        jobs.set(jobName, job);
      }
      return available([...jobs.values()].sort((a, b) => a.jobName.localeCompare(b.jobName)));
    });
  }
}
