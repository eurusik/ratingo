import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import {
  type BatchObservableCallback,
  type Meter,
  metrics,
  type ObservableGauge,
} from '@opentelemetry/api';
import { Queue } from 'bullmq';

import { CATALOG_POLICY_QUEUE } from '../modules/catalog-policy/public';
import {
  BACKFILL_QUEUE,
  INGESTION_QUEUE,
  RATINGS_BACKFILL_QUEUE,
} from '../modules/ingestion/public';
import { STATS_QUEUE } from '../modules/stats/public';

import { METER_NAME, QUEUE_JOB_STATES, QUEUE_JOBS_METRIC } from './telemetry.constants';

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name);
  private readonly queues: Queue[];
  private readonly meter: Meter = metrics.getMeter(METER_NAME);
  private gauge?: ObservableGauge;

  constructor(
    @InjectQueue(INGESTION_QUEUE) ingestion: Queue,
    @InjectQueue(BACKFILL_QUEUE) backfill: Queue,
    @InjectQueue(RATINGS_BACKFILL_QUEUE) ratingsBackfill: Queue,
    @InjectQueue(CATALOG_POLICY_QUEUE) catalogPolicy: Queue,
    @InjectQueue(STATS_QUEUE) stats: Queue,
  ) {
    this.queues = [ingestion, backfill, ratingsBackfill, catalogPolicy, stats];
  }

  onModuleInit(): void {
    this.gauge = this.meter.createObservableGauge(QUEUE_JOBS_METRIC, {
      description: 'BullMQ jobs per queue and state',
    });
    this.meter.addBatchObservableCallback(this.observe, [this.gauge]);
  }

  onModuleDestroy(): void {
    if (this.gauge) {
      this.meter.removeBatchObservableCallback(this.observe, [this.gauge]);
    }
  }

  private readonly observe: BatchObservableCallback = async (result) => {
    const { gauge } = this;
    if (!gauge) {
      return;
    }
    await Promise.all(
      this.queues.map(async (queue) => {
        try {
          const counts = await queue.getJobCounts(...QUEUE_JOB_STATES);
          QUEUE_JOB_STATES.forEach((state) =>
            result.observe(gauge, counts[state] ?? 0, { queue: queue.name, state }),
          );
        } catch (error) {
          this.logger.warn(
            `Failed to read job counts for queue ${queue.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );
  };
}
