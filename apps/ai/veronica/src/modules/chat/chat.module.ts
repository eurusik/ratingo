import { Logger, Module } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';
import {
  GrafanaLokiLogsAdapter,
  JobFailuresExecutor,
  LogsSearchExecutor,
  MetricsQueryExecutor,
  UnconfiguredJobFailuresAdapter,
  UnconfiguredLogsAdapter,
  type JobFailuresPort,
  type LogsPort,
  type MetricsPort,
} from '@ratingo/ai-ops-tools';

import { MCP_GATEWAY_HOST } from '../../core/mcp/mcp.constants';
import { DATABASE } from '../../database/database.constants';
import type { Database } from '../../database/database.module';
import {
  CHANGES_CONFIG,
  HAPPY_CONFIG,
  INFRA_CONFIG,
  LOKI_CONFIG,
  PRODUCT_STATS_CONFIG,
  TELEGRAM_CONFIG,
  type ChangesConfig,
  type HappyConfig,
  type InfraConfig,
  type LokiConfig,
  type ProductStatsConfig,
  type TelegramConfig,
} from '../../config/config.constants';
import { DigestModule, METRICS_PORT } from '../digest/public';
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
import { LOGS_PORT } from './domain/ports/logs.port';
import { RECENT_CHANGES_PORT } from './domain/ports/recent-changes.port';
import { WEBHOOK_SECRET_PORT } from './domain/ports/webhook-secret.port';
import { PostgresChatExchangeRepository } from './infrastructure/repositories/postgres.chat-exchange-repository';
import { GithubRecentChangesAdapter } from './infrastructure/adapters/github.recent-changes-adapter';
import { HttpHappyClient } from './infrastructure/adapters/http.happy-client';
import { PostgresJobFailuresAdapter } from './infrastructure/adapters/postgres.job-failures-adapter';
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
      provide: LOGS_PORT,
      inject: [LOKI_CONFIG],
      useFactory: ({ baseUrl, user, token }: LokiConfig) => {
        if (baseUrl !== undefined && user !== undefined && token !== undefined) {
          return new GrafanaLokiLogsAdapter({ baseUrl, user, token });
        }
        const missing = [
          ['GRAFANA_LOKI_URL', baseUrl],
          ['GRAFANA_LOKI_USER', user],
          ['GRAFANA_LOKI_TOKEN', token],
        ].flatMap(([name, value]) => (value === undefined ? [name] : []));
        if (missing.length < 3) {
          new Logger('LogsPort').warn(`logs_search is off, missing: ${missing.join(', ')}`);
        }
        return new UnconfiguredLogsAdapter();
      },
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
    ProductStatsExecutor,
    DigestSnapshotExecutor,
    RecentChangesExecutor,
    AskHappyExecutor,
    {
      provide: INVESTIGATION_EXECUTORS,
      inject: [
        METRICS_PORT,
        JOB_FAILURES_PORT,
        LOGS_PORT,
        CLOCK_PORT,
        ProductStatsExecutor,
        DigestSnapshotExecutor,
        RecentChangesExecutor,
        AskHappyExecutor,
      ],
      useFactory: (
        metricsPort: MetricsPort,
        failuresPort: JobFailuresPort,
        logsPort: LogsPort,
        clock: ClockPort,
        product: ProductStatsExecutor,
        snapshot: DigestSnapshotExecutor,
        changes: RecentChangesExecutor,
        happy: AskHappyExecutor,
      ): InvestigationExecutors => {
        const metrics = new MetricsQueryExecutor(metricsPort, clock);
        const failures = new JobFailuresExecutor(failuresPort, clock);
        const logs = new LogsSearchExecutor(logsPort, clock, new Logger(LogsSearchExecutor.name));
        return {
          metricsQuery: (input) => metrics.run(input),
          productStats: (input) => product.run(input),
          digestSnapshot: () => snapshot.run(),
          recentChanges: (input) => changes.run(input),
          askHappy: (input) => happy.run(input),
          jobFailures: (input) => failures.run(input),
          logsSearch: (input) => logs.run(input),
        };
      },
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
