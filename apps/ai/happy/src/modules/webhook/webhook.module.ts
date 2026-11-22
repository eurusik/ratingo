import { Module } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { REDIS_CONFIG, type RedisConfig } from '../../config/config.constants';
import { ReviewModule } from '../review/public';

import { WebhookService } from './application/services/webhook.service';
import { REVIEW_QUEUE_PORT } from './domain/ports/review-queue.port';
import { BullmqReviewQueue } from './infrastructure/queue/bullmq-review-queue';
import { ReviewWorker } from './infrastructure/queue/review.worker';
import { GithubWebhookController } from './presentation/controllers/github-webhook.controller';
import {
  REVIEW_QUEUE,
  REVIEW_QUEUE_INSTANCE,
  REVIEW_QUEUE_PREFIX,
  REVIEW_REDIS,
} from './webhook.constants';

@Module({
  imports: [ReviewModule],
  controllers: [GithubWebhookController],
  providers: [
    {
      provide: REVIEW_REDIS,
      inject: [REDIS_CONFIG],
      useFactory: (config: RedisConfig) => {
        if (config.url === undefined) {
          throw new Error('REDIS_URL is required to queue pull request reviews');
        }
        return new IORedis(config.url, { maxRetriesPerRequest: null });
      },
    },
    {
      provide: REVIEW_QUEUE_INSTANCE,
      inject: [REVIEW_REDIS],
      useFactory: (connection: IORedis) =>
        new Queue(REVIEW_QUEUE, { connection: connection.duplicate(), prefix: REVIEW_QUEUE_PREFIX }),
    },
    {
      provide: REVIEW_QUEUE_PORT,
      inject: [REVIEW_QUEUE_INSTANCE],
      useFactory: (queue: Queue) => new BullmqReviewQueue(queue),
    },
    WebhookService,
    ReviewWorker,
  ],
})
export class WebhookModule {}
