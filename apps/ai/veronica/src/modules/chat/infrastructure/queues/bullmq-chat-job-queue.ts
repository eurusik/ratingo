import type { OnApplicationShutdown } from '@nestjs/common';

import type { Queue } from 'bullmq';

import { CHAT_JOB_ID_PREFIX, CHAT_JOB_OPTIONS, CHAT_JOB_TYPES } from '../../chat.constants';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import type { ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';

export class BullmqChatJobQueue implements ChatJobQueuePort, OnApplicationShutdown {
  constructor(private readonly queue: Pick<Queue, 'add' | 'close'>) {}

  async enqueue(message: IncomingMessage): Promise<void> {
    await this.queue.add(CHAT_JOB_TYPES.MESSAGE, message, {
      ...CHAT_JOB_OPTIONS,
      jobId: `${CHAT_JOB_ID_PREFIX}${message.updateId}`,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
