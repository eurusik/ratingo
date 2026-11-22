import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import type { Queue } from 'bullmq';

import {
  CHAT_JOB_TYPES,
  CHAT_QUEUE_TOKEN,
  EXCHANGE_RETENTION_SCHEDULE,
} from '../../chat.constants';

@Injectable()
export class ChatExchangeRetentionScheduler implements OnModuleInit {
  constructor(@Inject(CHAT_QUEUE_TOKEN) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      EXCHANGE_RETENTION_SCHEDULE.id,
      { pattern: EXCHANGE_RETENTION_SCHEDULE.pattern, tz: EXCHANGE_RETENTION_SCHEDULE.timezone },
      {
        name: CHAT_JOB_TYPES.EXCHANGE_RETENTION,
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: { age: EXCHANGE_RETENTION_SCHEDULE.failedKeepSeconds },
        },
      },
    );
  }
}
