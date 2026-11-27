import { Inject, Injectable } from '@nestjs/common';

import type { SchedulerJobStat } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { UNKNOWN_LABEL } from '../../domain/constants/digest-text.constants';
import { METRICS_PORT, type MetricSample, type MetricsPort } from '../../domain/ports/metrics.port';

import { SCHEDULER_LAST_RUNS, SCHEDULER_NEXT_RUNS } from '@ratingo/ai-ops-tools';

import { guarded, hoursSince } from './collector-helpers';
import { plannedRuns } from './planned-runs';

const SUCCESS = 'success';
const FAILURE = 'failure';
const DEFAULT_TIMEZONE = 'UTC';
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 3_600_000;

const ageHours = (epochMs: number, nowMs: number): number =>
  Math.max(0, (nowMs - epochMs) / MS_PER_HOUR);

@Injectable()
export class SchedulerCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<SchedulerJobStat[]>> {
    return guarded(async () => {
      const [runs, next] = await Promise.all([
        this.metrics.instant(SCHEDULER_LAST_RUNS, nowMs),
        this.nextRuns(nowMs),
      ]);
      if (runs.length === 0 && next.length === 0) {
        return unavailable('метрики планувальника ще немає');
      }
      const jobs = new Map<string, SchedulerJobStat>();
      const jobOf = (jobName: string): SchedulerJobStat => {
        const job = jobs.get(jobName) ?? {
          jobName,
          lastSuccessAgeHours: null,
          lastFailureAgeHours: null,
          lastPlannedRunAgeHours: null,
          previousPlannedRunAgeHours: null,
        };
        jobs.set(jobName, job);
        return job;
      };
      for (const sample of runs) {
        const job = jobOf(sample.labels.job_name ?? UNKNOWN_LABEL);
        const age = hoursSince(sample.value, nowMs);
        if (sample.labels.result === SUCCESS) job.lastSuccessAgeHours = age;
        if (sample.labels.result === FAILURE) job.lastFailureAgeHours = age;
      }
      for (const sample of next) {
        const planned = plannedRuns(
          sample.labels.schedule ?? '',
          sample.labels.tz ?? DEFAULT_TIMEZONE,
          sample.value * MS_PER_SECOND,
          nowMs,
        );
        if (!planned) continue;
        const job = jobOf(sample.labels.job_name ?? UNKNOWN_LABEL);
        job.lastPlannedRunAgeHours = ageHours(planned.lastMs, nowMs);
        job.previousPlannedRunAgeHours = ageHours(planned.previousMs, nowMs);
      }
      return available([...jobs.values()].sort((a, b) => a.jobName.localeCompare(b.jobName)));
    });
  }

  private async nextRuns(nowMs: number): Promise<readonly MetricSample[]> {
    try {
      return await this.metrics.instant(SCHEDULER_NEXT_RUNS, nowMs);
    } catch {
      return [];
    }
  }
}
