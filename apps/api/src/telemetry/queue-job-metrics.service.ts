import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { type Histogram, type Meter, metrics } from '@opentelemetry/api';
import { type Job, type Worker } from 'bullmq';

import { findBullWorkers } from '../common/runtime/bull-workers';
import { JobFailureRecorder } from '../modules/job-failures/public';

import { SchedulerLastRunGauge, scheduledJobNameOf } from './scheduler-last-run.gauge';
import {
  METER_NAME,
  MS_PER_SECOND,
  QUEUE_JOB_DURATION_BUCKETS_SECONDS,
  QUEUE_JOB_DURATION_METRIC,
  QUEUE_JOB_RESULT,
  SCHEDULER_RUN_RESULT,
  type QueueJobResult,
} from './telemetry.constants';

const willRetry = (job: Job): boolean => job.attemptsMade < (job.opts.attempts ?? 1);

@Injectable()
export class QueueJobMetricsService implements OnApplicationBootstrap {
  private readonly meter: Meter = metrics.getMeter(METER_NAME);
  private readonly schedulerLastRun = new SchedulerLastRunGauge();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly jobFailures: JobFailureRecorder,
  ) {}

  onApplicationBootstrap(): void {
    const duration = this.meter.createHistogram(QUEUE_JOB_DURATION_METRIC, {
      description:
        'Duration of BullMQ jobs processed by this worker, by queue, job name and result',
      unit: 's',
      advice: { explicitBucketBoundaries: QUEUE_JOB_DURATION_BUCKETS_SECONDS },
    });
    this.schedulerLastRun.register(this.meter);
    findBullWorkers(this.discovery).forEach((worker) => this.instrument(worker, duration));
  }

  private instrument(worker: Worker, duration: Histogram): void {
    worker.on('completed', (job) => {
      this.record(duration, worker, job, QUEUE_JOB_RESULT.COMPLETED);
      this.schedulerLastRun.record(job, SCHEDULER_RUN_RESULT.SUCCESS);
    });
    worker.on('failed', (job, error) => {
      if (!job) return;
      const result = willRetry(job) ? QUEUE_JOB_RESULT.RETRIED : QUEUE_JOB_RESULT.FAILED;
      this.record(duration, worker, job, result);
      if (result === QUEUE_JOB_RESULT.FAILED) {
        this.schedulerLastRun.record(job, SCHEDULER_RUN_RESULT.FAILURE);
      }
      this.reportFailure(worker, job, error, result === QUEUE_JOB_RESULT.FAILED);
    });
  }

  private reportFailure(worker: Worker, job: Job, error: Error, attemptsExhausted: boolean): void {
    void this.jobFailures.record({
      queue: worker.name,
      jobType: job.name,
      schedulerJobId: scheduledJobNameOf(job.repeatJobKey) ?? null,
      attemptsExhausted,
      failedAtMs: job.finishedOn,
      error,
    });
  }

  private record(duration: Histogram, worker: Worker, job: Job, result: QueueJobResult): void {
    if (!job.processedOn) return;
    const finishedOn = job.finishedOn ?? Date.now();
    duration.record((finishedOn - job.processedOn) / MS_PER_SECOND, {
      queue: worker.name,
      'job.name': job.name,
      result,
    });
  }
}
