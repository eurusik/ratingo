import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import type { Queue } from 'bullmq';

import {
  WATCHDOG_INTERVAL_MS,
  WATCHDOG_JOB_OPTIONS,
  WATCHDOG_JOB_TYPES,
  WATCHDOG_QUEUE_TOKEN,
  WATCHDOG_SCHEDULER_ID,
} from '../../watchdog.constants';

@Injectable()
export class WatchdogSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WatchdogSchedulerService.name);

  constructor(@Inject(WATCHDOG_QUEUE_TOKEN) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      WATCHDOG_SCHEDULER_ID,
      { every: WATCHDOG_INTERVAL_MS },
      { name: WATCHDOG_JOB_TYPES.TICK, data: {}, opts: { ...WATCHDOG_JOB_OPTIONS } },
    );
    this.logger.log(`Сторож перевіряє систему кожні ${WATCHDOG_INTERVAL_MS / 60_000} хв`);
  }
}
