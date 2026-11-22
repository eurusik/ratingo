import { Module } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import {
  CHANGES_CONFIG,
  INFRA_CONFIG,
  TELEGRAM_CONFIG,
  type ChangesConfig,
  type InfraConfig,
  type TelegramConfig,
} from '../../config/config.constants';
import { DigestModule } from '../digest/public';
import { NotifyModule } from '../notify/public';

import { ChatCommandHandlers } from './application/commands/chat-command.handlers';
import { ChatService } from './application/services/chat.service';
import { InvestigationRunner } from './application/services/investigation.runner';
import { ChatWebhookService } from './application/services/chat-webhook.service';
import { WebhookRegistrationService } from './application/services/webhook-registration.service';
import { ChatWorker } from './application/workers/chat.worker';
import { DigestSnapshotExecutor } from './application/tools/digest-snapshot.executor';
import {
  INVESTIGATION_EXECUTORS,
  type InvestigationExecutors,
} from './application/tools/investigation-executors';
import { MetricsQueryExecutor } from './application/tools/metrics-query.executor';
import { ProductStatsExecutor } from './application/tools/product-stats.executor';
import { RecentChangesExecutor } from './application/tools/recent-changes.executor';
import {
  CHAT_QUEUE,
  CHAT_QUEUE_PREFIX,
  CHAT_QUEUE_TOKEN,
  REDIS_CONNECTION,
} from './chat.constants';
import { CHAT_JOB_QUEUE } from './domain/ports/chat-job-queue.port';
import { CHAT_METRICS_PORT } from './domain/ports/chat-metrics.port';
import { CONVERSATION_STORE } from './domain/ports/conversation-store.port';
import { RECENT_CHANGES_PORT } from './domain/ports/recent-changes.port';
import { WEBHOOK_SECRET_PORT } from './domain/ports/webhook-secret.port';
import { GithubRecentChangesAdapter } from './infrastructure/adapters/github.recent-changes-adapter';
import { BullmqChatJobQueue } from './infrastructure/queues/bullmq-chat-job-queue';
import { HmacWebhookSecret } from './infrastructure/security/hmac-webhook-secret';
import { RedisConversationStore } from './infrastructure/stores/redis.conversation-store';
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
    {
      provide: CONVERSATION_STORE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) => new RedisConversationStore(connection),
    },
    {
      provide: RECENT_CHANGES_PORT,
      inject: [CHANGES_CONFIG],
      useFactory: (config: ChangesConfig) => new GithubRecentChangesAdapter(config),
    },
    MetricsQueryExecutor,
    ProductStatsExecutor,
    DigestSnapshotExecutor,
    RecentChangesExecutor,
    {
      provide: INVESTIGATION_EXECUTORS,
      inject: [
        MetricsQueryExecutor,
        ProductStatsExecutor,
        DigestSnapshotExecutor,
        RecentChangesExecutor,
      ],
      useFactory: (
        metrics: MetricsQueryExecutor,
        product: ProductStatsExecutor,
        snapshot: DigestSnapshotExecutor,
        changes: RecentChangesExecutor,
      ): InvestigationExecutors => ({
        metricsQuery: (input) => metrics.run(input),
        productStats: (input) => product.run(input),
        digestSnapshot: () => snapshot.run(),
        recentChanges: (input) => changes.run(input),
      }),
    },
    InvestigationRunner,
    ChatCommandHandlers,
    ChatService,
    ChatWebhookService,
    WebhookRegistrationService,
    ChatWorker,
  ],
})
export class ChatModule {}
