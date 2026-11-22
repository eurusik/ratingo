import { Inject, Injectable } from '@nestjs/common';

import { BASELINE_OFFSET_DAYS } from '../../digest.constants';
import { measured } from '../../domain/entities/measured';
import type { FailedJob, QueueStats } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { METRICS_PORT, type MetricsPort } from '../../domain/ports/metrics.port';

import { baselineAt, guarded, valueByLabel } from './collector-helpers';

const BACKLOG_STATES = 'state=~"waiting|delayed|prioritized"';
const BACKLOG = `sum by (queue) (app_queue_jobs{${BACKLOG_STATES}})`;
const BACKLOG_MAX = `max_over_time(${BACKLOG}[24h:5m])`;
const jobsByResult = (result: string, groupBy = 'queue') =>
  `sum by (${groupBy}) (increase(app_queue_job_duration_seconds_count{result="${result}"}[24h]))`;

interface QueueReadings {
  backlogNow: Map<string, number>;
  backlogMax: Map<string, number>;
  completed: Map<string, number>;
  failed: Map<string, number>;
  retried: Map<string, number>;
}

@Injectable()
export class QueuesCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<QueueStats[]>> {
    return guarded(async () => {
      const baselineMs = baselineAt(nowMs, BASELINE_OFFSET_DAYS);
      const [current, baseline, failedJobs] = await Promise.all([
        this.readAt(nowMs),
        this.readAt(baselineMs),
        this.metrics.instant(jobsByResult('failed', 'queue, job_name'), nowMs),
      ]);
      if (current.completed.size === 0 && current.backlogMax.size === 0) {
        return unavailable('метрик черг немає');
      }
      const baselineKnown = baseline.completed.size > 0;
      const queues = [
        ...new Set([
          ...current.backlogMax.keys(),
          ...current.completed.keys(),
          ...current.failed.keys(),
        ]),
      ].sort();
      return available(
        queues.map((queue): QueueStats => ({
          queue,
          backlogNow: current.backlogNow.get(queue) ?? 0,
          backlogMax24h: measured(
            Math.round(current.backlogMax.get(queue) ?? 0),
            baseline.backlogMax.has(queue) ? Math.round(baseline.backlogMax.get(queue) ?? 0) : null,
          ),
          completed24h: this.pair(queue, current.completed, baseline.completed, baselineKnown),
          failed24h: this.pair(queue, current.failed, baseline.failed, baselineKnown),
          retried24h: this.pair(queue, current.retried, baseline.retried, baselineKnown),
          failedJobs: failedJobs
            .filter((sample) => sample.labels.queue === queue && sample.value > 0)
            .map((sample): FailedJob => ({
              jobName: sample.labels.job_name ?? 'невідоме',
              count: Math.round(sample.value),
            })),
        })),
      );
    });
  }

  private pair(
    queue: string,
    current: Map<string, number>,
    baseline: Map<string, number>,
    baselineKnown: boolean,
  ) {
    return measured(
      Math.round(current.get(queue) ?? 0),
      baselineKnown ? Math.round(baseline.get(queue) ?? 0) : null,
    );
  }

  private async readAt(atMs: number): Promise<QueueReadings> {
    const [backlogNow, backlogMax, completed, failed, retried] = await Promise.all([
      this.metrics.instant(BACKLOG, atMs),
      this.metrics.instant(BACKLOG_MAX, atMs),
      this.metrics.instant(jobsByResult('completed'), atMs),
      this.metrics.instant(jobsByResult('failed'), atMs),
      this.metrics.instant(jobsByResult('retried'), atMs),
    ]);
    return {
      backlogNow: valueByLabel(backlogNow, 'queue'),
      backlogMax: valueByLabel(backlogMax, 'queue'),
      completed: valueByLabel(completed, 'queue'),
      failed: valueByLabel(failed, 'queue'),
      retried: valueByLabel(retried, 'queue'),
    };
  }
}
