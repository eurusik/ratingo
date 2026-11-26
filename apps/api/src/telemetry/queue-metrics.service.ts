import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import {
  type BatchObservableCallback,
  type Meter,
  metrics,
  type ObservableGauge,
} from '@opentelemetry/api';
import { type JobSchedulerJson, Queue } from 'bullmq';

import { errorMessage } from '@/common/utils/error.utils';

import schedulerConfig from '../config/scheduler.config';
import { CATALOG_POLICY_QUEUE } from '../modules/catalog-policy/public';
import {
  BACKFILL_QUEUE,
  INGESTION_QUEUE,
  RATINGS_BACKFILL_QUEUE,
} from '../modules/ingestion/public';
import { MONITORING_QUEUE } from '../modules/monitoring/public';
import { STATS_QUEUE } from '../modules/stats/public';
import { USER_NOTIFICATIONS_QUEUE } from '../modules/user-actions/public';

import { scheduledJobNames } from './scheduler-last-run.gauge';
import {
  METER_NAME,
  MS_PER_SECOND,
  QUEUE_JOB_STATES,
  QUEUE_JOBS_METRIC,
  SCHEDULER_KEY_SEPARATOR,
  SCHEDULER_NEXT_RUN_METRIC,
} from './telemetry.constants';

const scheduleOf = (scheduler: JobSchedulerJson): string | undefined =>
  scheduler.pattern ?? (scheduler.every ? `every ${scheduler.every / MS_PER_SECOND}s` : undefined);

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name);
  private readonly queues: Queue[];
  private readonly meter: Meter = metrics.getMeter(METER_NAME);
  private readonly allowedJobNames = scheduledJobNames();
  private readonly schedulerKeyPrefix = `${schedulerConfig().envPrefix}${SCHEDULER_KEY_SEPARATOR}`;
  private gauge?: ObservableGauge;
  private nextRunGauge?: ObservableGauge;

  constructor(
    @InjectQueue(INGESTION_QUEUE) ingestion: Queue,
    @InjectQueue(BACKFILL_QUEUE) backfill: Queue,
    @InjectQueue(RATINGS_BACKFILL_QUEUE) ratingsBackfill: Queue,
    @InjectQueue(CATALOG_POLICY_QUEUE) catalogPolicy: Queue,
    @InjectQueue(STATS_QUEUE) stats: Queue,
    @InjectQueue(MONITORING_QUEUE) monitoring: Queue,
    @InjectQueue(USER_NOTIFICATIONS_QUEUE) userNotifications: Queue,
  ) {
    this.queues = [
      ingestion,
      backfill,
      ratingsBackfill,
      catalogPolicy,
      stats,
      monitoring,
      userNotifications,
    ];
  }

  onModuleInit(): void {
    this.gauge = this.meter.createObservableGauge(QUEUE_JOBS_METRIC, {
      description: 'BullMQ jobs per queue and state',
    });
    this.nextRunGauge = this.meter.createObservableGauge(SCHEDULER_NEXT_RUN_METRIC, {
      description:
        'Unix time of the next planned run of each scheduled job, read from its BullMQ job scheduler, with its cron pattern and timezone; absent when the job is not scheduled',
      unit: 's',
    });
    this.meter.addBatchObservableCallback(this.observe, [this.gauge, this.nextRunGauge]);
  }

  onModuleDestroy(): void {
    if (this.gauge && this.nextRunGauge) {
      this.meter.removeBatchObservableCallback(this.observe, [this.gauge, this.nextRunGauge]);
    }
  }

  private readonly observe: BatchObservableCallback = async (result) => {
    const { gauge, nextRunGauge } = this;
    if (!gauge || !nextRunGauge) {
      return;
    }
    await Promise.all([
      ...this.queues.map(async (queue) => {
        try {
          const counts = await queue.getJobCounts(...QUEUE_JOB_STATES);
          QUEUE_JOB_STATES.forEach((state) =>
            result.observe(gauge, counts[state] ?? 0, { queue: queue.name, state }),
          );
        } catch (error) {
          this.logger.warn(
            `Failed to read job counts for queue ${queue.name}: ${errorMessage(error)}`,
          );
        }
      }),
      ...this.queues.map(async (queue) => {
        try {
          const schedulers = await queue.getJobSchedulers();
          for (const scheduler of schedulers) {
            const jobName = this.toJobName(scheduler.key);
            const schedule = scheduleOf(scheduler);
            if (!jobName || !scheduler.next || !schedule) continue;
            result.observe(nextRunGauge, scheduler.next / MS_PER_SECOND, {
              job_name: jobName,
              schedule,
              tz: scheduler.tz ?? 'UTC',
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to read job schedulers for queue ${queue.name}: ${errorMessage(error)}`,
          );
        }
      }),
    ]);
  };

  private toJobName(key: string): string | undefined {
    if (!key.startsWith(this.schedulerKeyPrefix)) return undefined;
    const jobName = key.slice(this.schedulerKeyPrefix.length);
    return this.allowedJobNames.has(jobName) ? jobName : undefined;
  }
}
