import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CATALOG_POLICY_QUEUE } from '../modules/catalog-policy/public';
import {
  BACKFILL_QUEUE,
  INGESTION_QUEUE,
  RATINGS_BACKFILL_QUEUE,
} from '../modules/ingestion/public';
import { JobFailuresModule } from '../modules/job-failures/job-failures.module';
import { MONITORING_QUEUE } from '../modules/monitoring/public';
import { STATS_QUEUE } from '../modules/stats/public';
import { USER_NOTIFICATIONS_QUEUE } from '../modules/user-actions/public';

import { QueueJobMetricsService } from './queue-job-metrics.service';
import { QueueMetricsService } from './queue-metrics.service';

@Module({
  imports: [
    DiscoveryModule,
    JobFailuresModule,
    BullModule.registerQueue(
      { name: INGESTION_QUEUE },
      { name: BACKFILL_QUEUE },
      { name: RATINGS_BACKFILL_QUEUE },
      { name: CATALOG_POLICY_QUEUE },
      { name: STATS_QUEUE },
      { name: MONITORING_QUEUE },
      { name: USER_NOTIFICATIONS_QUEUE },
    ),
  ],
  providers: [QueueMetricsService, QueueJobMetricsService],
})
export class QueueMetricsModule {}
