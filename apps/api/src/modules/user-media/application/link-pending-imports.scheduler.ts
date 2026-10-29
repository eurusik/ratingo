import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { type Queue } from 'bullmq';

import schedulerConfig from '../../../config/scheduler.config';
import {
  BACKFILL_QUEUE,
  DEFAULT_INGESTION_JOB_OPTIONS,
  IngestionJob,
} from '../../shared/contracts';
import {
  LINK_PENDING_IMPORTS_INTERVAL_MS,
  LINK_PENDING_IMPORTS_SCHEDULER_ID,
} from '../domain/constants/import-pending.constants';

@Injectable()
export class LinkPendingImportsScheduler implements OnModuleInit {
  private readonly logger = new Logger(LinkPendingImportsScheduler.name);

  constructor(
    @InjectQueue(BACKFILL_QUEUE)
    private readonly backfillQueue: Queue,
    @Inject(schedulerConfig.KEY)
    private readonly config: ConfigType<typeof schedulerConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn(
        'Scheduler DISABLED (SCHEDULER_ENABLED=false): link-pending-imports sweeper not registered',
      );
      return;
    }

    const schedulerId = `${this.config.envPrefix}:${LINK_PENDING_IMPORTS_SCHEDULER_ID}`;
    try {
      await this.backfillQueue.upsertJobScheduler(
        schedulerId,
        { every: LINK_PENDING_IMPORTS_INTERVAL_MS },
        { name: IngestionJob.LINK_PENDING_IMPORTS, data: {}, opts: DEFAULT_INGESTION_JOB_OPTIONS },
      );
      this.logger.log(`[${schedulerId}] every ${LINK_PENDING_IMPORTS_INTERVAL_MS}ms`);
    } catch (error) {
      this.logger.error(`Failed to register ${schedulerId}: ${(error as Error).message}`);
    }
  }
}
