import { Module } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import {
  INFRA_CONFIG,
  TELEGRAM_CONFIG,
  type InfraConfig,
  type TelegramConfig,
} from '../../config/config.constants';
import { DigestModule } from '../digest/public';
import { NotifyModule } from '../notify/public';

import { ChatCommandHandlers } from './application/commands/chat-command.handlers';
import { ChatService } from './application/services/chat.service';
import { ChatWebhookService } from './application/services/chat-webhook.service';
import { WebhookRegistrationService } from './application/services/webhook-registration.service';
import { ChatWorker } from './application/workers/chat.worker';
import {
  CHAT_QUEUE,
  CHAT_QUEUE_PREFIX,
  CHAT_QUEUE_TOKEN,
  REDIS_CONNECTION,
} from './chat.constants';
import { CHAT_JOB_QUEUE } from './domain/ports/chat-job-queue.port';
import { CHAT_METRICS_PORT } from './domain/ports/chat-metrics.port';
import { WEBHOOK_SECRET_PORT } from './domain/ports/webhook-secret.port';
import { BullmqChatJobQueue } from './infrastructure/queues/bullmq-chat-job-queue';
import { HmacWebhookSecret } from './infrastructure/security/hmac-webhook-secret';
import { OtelChatMetrics } from './infrastructure/telemetry/otel-chat-metrics';
import { TelegramWebhookController } from './presentation/telegram-webhook.controller';

@Module({
  imports: [DigestModule, NotifyModule],
  controllers: [TelegramWebhookController],
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [INFRA_CONFIG],
      useFactory: (config: InfraConfig) =>
        new IORedis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    {
      provide: CHAT_QUEUE_TOKEN,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue(CHAT_QUEUE, { connection: connection.duplicate(), prefix: CHAT_QUEUE_PREFIX }),
    },
    {
      provide: CHAT_JOB_QUEUE,
      inject: [CHAT_QUEUE_TOKEN],
      useFactory: (queue: Queue) => new BullmqChatJobQueue(queue),
    },
    {
      provide: WEBHOOK_SECRET_PORT,
      inject: [TELEGRAM_CONFIG],
      useFactory: (config: TelegramConfig) => new HmacWebhookSecret(config.botToken),
    },
    { provide: CHAT_METRICS_PORT, useFactory: () => new OtelChatMetrics() },
    ChatCommandHandlers,
    ChatService,
    ChatWebhookService,
    WebhookRegistrationService,
    ChatWorker,
  ],
})
export class ChatModule {}
