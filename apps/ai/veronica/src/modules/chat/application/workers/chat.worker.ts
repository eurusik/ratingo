import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';

import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';

import type { ClosableExplorerPort } from '@ratingo/ai-ops-tools';

import { NotificationError } from '../../../notify/public';
import {
  CHAT_JOB_TYPES,
  CHAT_QUEUE,
  CHAT_QUEUE_PREFIX,
  CHAT_WORKER_CONCURRENCY,
  REDIS_CONNECTION,
} from '../../chat.constants';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import type { DumeFollowUp } from '../../domain/entities/dume';
import { HappyReviewMode, type HappyFollowUp } from '../../domain/entities/happy';
import { EXPLORER_PORT } from '../../domain/ports/explorer.port';
import { ChatExchangeRetention } from '../services/chat-exchange-retention.service';
import { ChatService } from '../services/chat.service';
import { DumeFollowUpService } from '../services/dume-follow-up.service';
import { HappyFollowUpService } from '../services/happy-follow-up.service';
import { withRedisErrorLog } from '../../../../redis/redis-error-log';

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
    typeof candidate.attempt === 'number' &&
    (candidate.mode === undefined || candidate.mode === HappyReviewMode.FULL)
  );
};

const isDumeFollowUp = (value: unknown): value is DumeFollowUp => {
  const candidate = value as Partial<DumeFollowUp> | null;
  return (
    typeof candidate?.chatId === 'string' &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.createdAtMs === 'number' &&
    typeof candidate.attempt === 'number' &&
    (candidate.deliveryAttempts === undefined || typeof candidate.deliveryAttempts === 'number')
  );
};

@Injectable()
export class ChatWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ChatWorker.name);
  private worker?: Worker;

  constructor(
    private readonly chat: ChatService,
    private readonly followUps: HappyFollowUpService,
    private readonly dumeFollowUps: DumeFollowUpService,
    private readonly retention: ChatExchangeRetention,
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
    @Inject(EXPLORER_PORT) private readonly explorer: ClosableExplorerPort,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(CHAT_QUEUE, (job) => this.process(job), {
      connection: withRedisErrorLog(this.connection.duplicate(), 'chat-worker'),
      prefix: CHAT_QUEUE_PREFIX,
      concurrency: CHAT_WORKER_CONCURRENCY,
    });
    this.worker.on('failed', (job, error) => this.onFailed(job, error));
  }

  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Повідомлення ${job?.id ?? '?'} не оброблено: ${error.message}`);
    if (job !== undefined && this.isFinalDumeFailure(job, error)) {
      void this.dumeFollowUps.abandon(job.data as DumeFollowUp);
    }
  }

  private isFinalDumeFailure(job: Job, error: Error): boolean {
    if (job.name !== CHAT_JOB_TYPES.DUME_FOLLOW_UP || !isDumeFollowUp(job.data)) return false;
    return error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
  }

  async onApplicationShutdown(): Promise<void> {
    const failures: Error[] = [];
    await this.closeStep('worker', failures, async () => this.worker?.close());
    await this.closeStep('explorer', failures, async () => this.explorer.close?.());
    await this.closeStep('redis', failures, async () => this.connection.disconnect());
    const [first] = failures;
    if (first !== undefined) throw first;
  }

  private async closeStep(
    step: string,
    failures: Error[],
    close: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await close();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Не вдалося закрити ${step} під час зупинки: ${failure.message}`);
      failures.push(failure);
    }
  }

  async process(job: Pick<Job, 'name' | 'data'>): Promise<string> {
    try {
      if (job.name === CHAT_JOB_TYPES.MESSAGE && isIncomingMessage(job.data)) {
        return await this.chat.handle(job.data);
      }
      if (job.name === CHAT_JOB_TYPES.HAPPY_FOLLOW_UP && isHappyFollowUp(job.data)) {
        return await this.followUps.handle(job.data);
      }
      if (job.name === CHAT_JOB_TYPES.DUME_FOLLOW_UP && isDumeFollowUp(job.data)) {
        return await this.dumeFollowUps.handle(job.data);
      }
      if (job.name === CHAT_JOB_TYPES.EXCHANGE_RETENTION) {
        return `deleted:${await this.retention.purge()}`;
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
