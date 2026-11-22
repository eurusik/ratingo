import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';

import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';

import { NotificationError } from '../../../notify/public';
import {
  CHAT_JOB_TYPES,
  CHAT_QUEUE,
  CHAT_QUEUE_PREFIX,
  CHAT_WORKER_CONCURRENCY,
  REDIS_CONNECTION,
} from '../../chat.constants';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import type { HappyFollowUp } from '../../domain/entities/happy';
import { ChatService } from '../services/chat.service';
import { HappyFollowUpService } from '../services/happy-follow-up.service';

const isIncomingMessage = (value: unknown): value is IncomingMessage => {
  const candidate = value as Partial<IncomingMessage> | null;
  return (
    typeof candidate?.updateId === 'number' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.chatId === 'string' &&
    typeof candidate.chatType === 'string' &&
    typeof candidate.text === 'string'
  );
};

const isHappyFollowUp = (value: unknown): value is HappyFollowUp => {
  const candidate = value as Partial<HappyFollowUp> | null;
  return (
    typeof candidate?.chatId === 'string' &&
    typeof candidate.pullNumber === 'number' &&
    typeof candidate.headSha === 'string' &&
    typeof candidate.attempt === 'number'
  );
};

@Injectable()
export class ChatWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ChatWorker.name);
  private worker?: Worker;

  constructor(
    private readonly chat: ChatService,
    private readonly followUps: HappyFollowUpService,
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(CHAT_QUEUE, (job) => this.process(job), {
      connection: this.connection.duplicate(),
      prefix: CHAT_QUEUE_PREFIX,
      concurrency: CHAT_WORKER_CONCURRENCY,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Повідомлення ${job?.id ?? '?'} не оброблено: ${error.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    this.connection.disconnect();
  }

  async process(job: Pick<Job, 'name' | 'data'>): Promise<string> {
    try {
      if (job.name === CHAT_JOB_TYPES.MESSAGE && isIncomingMessage(job.data)) {
        return await this.chat.handle(job.data);
      }
      if (job.name === CHAT_JOB_TYPES.HAPPY_FOLLOW_UP && isHappyFollowUp(job.data)) {
        return await this.followUps.handle(job.data);
      }
      this.logger.warn(`Невідоме завдання чату ${job.name}`);
      return 'ignored';
    } catch (error) {
      if (error instanceof NotificationError && (!error.retryable || error.deliveryUnknown)) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }
}
