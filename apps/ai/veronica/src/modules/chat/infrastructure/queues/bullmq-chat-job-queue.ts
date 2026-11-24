import type { OnApplicationShutdown } from '@nestjs/common';

import type { Queue } from 'bullmq';

import { CHAT_JOB_ID_PREFIX, CHAT_JOB_OPTIONS, CHAT_JOB_TYPES } from '../../chat.constants';
import { HappyReviewMode, type HappyFollowUp } from '../../domain/entities/happy';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import type { ChatJobQueuePort } from '../../domain/ports/chat-job-queue.port';

export class BullmqChatJobQueue implements ChatJobQueuePort, OnApplicationShutdown {
  constructor(private readonly queue: Pick<Queue, 'add' | 'close' | 'getJob'>) {}

  async enqueue(message: IncomingMessage): Promise<void> {
    await this.queue.add(CHAT_JOB_TYPES.MESSAGE, message, {
      ...CHAT_JOB_OPTIONS,
      jobId: `${CHAT_JOB_ID_PREFIX}${message.updateId}`,
    });
  }

  async scheduleHappyFollowUp(followUp: HappyFollowUp, delayMs: number): Promise<void> {
    const jobId = [
      'happy-follow-up',
      followUp.chatId,
      followUp.pullNumber,
      followUp.headSha,
      followUp.attempt,
      ...(followUp.mode === HappyReviewMode.FULL ? [followUp.mode] : []),
    ].join('_');
    const existing = await this.queue.getJob(jobId);
    if (existing !== undefined) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') {
        await existing.remove();
      }
    }
    await this.queue.add(CHAT_JOB_TYPES.HAPPY_FOLLOW_UP, followUp, {
      ...CHAT_JOB_OPTIONS,
      delay: delayMs,
      jobId,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
