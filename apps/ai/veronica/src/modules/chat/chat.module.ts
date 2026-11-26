import { Module } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { MCP_GATEWAY_HOST } from '../../core/mcp/mcp.constants';
import { DATABASE } from '../../database/database.constants';
import type { Database } from '../../database/database.module';
import {
  CHANGES_CONFIG,
  HAPPY_CONFIG,
  INFRA_CONFIG,
  PRODUCT_STATS_CONFIG,
  TELEGRAM_CONFIG,
  type ChangesConfig,
  type HappyConfig,
  type InfraConfig,
  type ProductStatsConfig,
  type TelegramConfig,
} from '../../config/config.constants';
import { DigestModule } from '../digest/public';
import { NotifyModule } from '../notify/public';

import { ChatCommandHandlers } from './application/commands/chat-command.handlers';
import { ChatExchangeRecorder } from './application/services/chat-exchange-recorder.service';
import { ChatExchangeRetention } from './application/services/chat-exchange-retention.service';
import { ChatExchangeRetentionScheduler } from './application/services/chat-exchange-retention.scheduler';
import { HappyChatService } from './application/services/happy-chat.service';
import { HappyFollowUpService } from './application/services/happy-follow-up.service';
import { ChatService } from './application/services/chat.service';
import { InvestigationRunner } from './application/services/investigation.runner';
import { ChatWebhookService } from './application/services/chat-webhook.service';
import { WebhookRegistrationService } from './application/services/webhook-registration.service';
import { ChatWorker } from './application/workers/chat.worker';
import { AskHappyExecutor } from './application/tools/ask-happy.executor';
import { DigestSnapshotExecutor } from './application/tools/digest-snapshot.executor';
import { EXTERNAL_TOOLS } from './application/tools/external-tools';
import {
  INVESTIGATION_EXECUTORS,
  type InvestigationExecutors,
} from './application/tools/investigation-executors';
import { JobFailuresExecutor } from './application/tools/job-failures.executor';
import { MetricsQueryExecutor } from './application/tools/metrics-query.executor';
import { ProductStatsExecutor } from './application/tools/product-stats.executor';
import { RecentChangesExecutor } from './application/tools/recent-changes.executor';
import {
  CHAT_QUEUE,
  CHAT_QUEUE_PREFIX,
  CHAT_QUEUE_TOKEN,
  REDIS_CONNECTION,
} from './chat.constants';
import { CHAT_EXCHANGE_LOG } from './domain/ports/chat-exchange-log.port';
import { CHAT_JOB_QUEUE } from './domain/ports/chat-job-queue.port';
import { CHAT_METRICS_PORT } from './domain/ports/chat-metrics.port';
import { CONVERSATION_STORE } from './domain/ports/conversation-store.port';
import { HAPPY_CLIENT } from './domain/ports/happy-client.port';
import { JOB_FAILURES_PORT } from './domain/ports/job-failures.port';
import { RECENT_CHANGES_PORT } from './domain/ports/recent-changes.port';
import { WEBHOOK_SECRET_PORT } from './domain/ports/webhook-secret.port';
import { PostgresChatExchangeRepository } from './infrastructure/repositories/postgres.chat-exchange-repository';
import { GithubRecentChangesAdapter } from './infrastructure/adapters/github.recent-changes-adapter';
import { HttpHappyClient } from './infrastructure/adapters/http.happy-client';
import { PostgresJobFailuresAdapter } from './infrastructure/adapters/postgres.job-failures-adapter';
import { UnconfiguredJobFailuresAdapter } from './infrastructure/adapters/unconfigured.job-failures-adapter';
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
    {
      provide: HAPPY_CLIENT,
      inject: [HAPPY_CONFIG],
      useFactory: (config: HappyConfig) => new HttpHappyClient(config),
    },
    {
      provide: JOB_FAILURES_PORT,
      inject: [PRODUCT_STATS_CONFIG],
      useFactory: (config: ProductStatsConfig) =>
        config.readerDatabaseUrl === undefined
          ? new UnconfiguredJobFailuresAdapter()
          : PostgresJobFailuresAdapter.connect(config.readerDatabaseUrl),
    },
    {
      provide: CHAT_EXCHANGE_LOG,
      inject: [DATABASE],
      useFactory: (db: Database) => new PostgresChatExchangeRepository(db),
    },
    { provide: EXTERNAL_TOOLS, useExisting: MCP_GATEWAY_HOST },
    ChatExchangeRecorder,
    ChatExchangeRetention,
    ChatExchangeRetentionScheduler,
    MetricsQueryExecutor,
    ProductStatsExecutor,
    DigestSnapshotExecutor,
    RecentChangesExecutor,
    AskHappyExecutor,
    JobFailuresExecutor,
    {
      provide: INVESTIGATION_EXECUTORS,
      inject: [
        MetricsQueryExecutor,
        ProductStatsExecutor,
        DigestSnapshotExecutor,
        RecentChangesExecutor,
        AskHappyExecutor,
        JobFailuresExecutor,
      ],
      useFactory: (
        metrics: MetricsQueryExecutor,
        product: ProductStatsExecutor,
        snapshot: DigestSnapshotExecutor,
        changes: RecentChangesExecutor,
        happy: AskHappyExecutor,
        failures: JobFailuresExecutor,
      ): InvestigationExecutors => ({
        metricsQuery: (input) => metrics.run(input),
        productStats: (input) => product.run(input),
        digestSnapshot: () => snapshot.run(),
        recentChanges: (input) => changes.run(input),
        askHappy: (input) => happy.run(input),
        jobFailures: (input) => failures.run(input),
      }),
    },
    InvestigationRunner,
    HappyChatService,
    HappyFollowUpService,
    ChatCommandHandlers,
    ChatService,
    ChatWebhookService,
    WebhookRegistrationService,
    ChatWorker,
  ],
})
export class ChatModule {}
