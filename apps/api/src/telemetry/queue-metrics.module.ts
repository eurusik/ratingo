import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CATALOG_POLICY_QUEUE } from '../modules/catalog-policy/public';
import {
  BACKFILL_QUEUE,
  INGESTION_QUEUE,
  RATINGS_BACKFILL_QUEUE,
} from '../modules/ingestion/public';
import { STATS_QUEUE } from '../modules/stats/public';

import { QueueJobMetricsService } from './queue-job-metrics.service';
import { QueueMetricsService } from './queue-metrics.service';

@Module({
  imports: [
    DiscoveryModule,
    BullModule.registerQueue(
      { name: INGESTION_QUEUE },
      { name: BACKFILL_QUEUE },
      { name: RATINGS_BACKFILL_QUEUE },
      { name: CATALOG_POLICY_QUEUE },
      { name: STATS_QUEUE },
    ),
  ],
  providers: [QueueMetricsService, QueueJobMetricsService],
})
export class QueueMetricsModule {}
