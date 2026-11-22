import { type DynamicModule, Global, Module } from '@nestjs/common';

import {
  ANTHROPIC_CONFIG,
  CHANGES_CONFIG,
  CHAT_CONFIG,
  GRAFANA_CONFIG,
  HAPPY_CONFIG,
  INFRA_CONFIG,
  MODEL_ALIASES,
  PRODUCT_STATS_CONFIG,
  TELEGRAM_CONFIG,
  type AnthropicConfig,
  type ChangesConfig,
  type GrafanaConfig,
  type HappyConfig,
  type InfraConfig,
  type ProductStatsConfig,
  type TelegramConfig,
} from './config.constants';
import { buildChatConfig } from './chat.config';
import { previewEnvSchema, serviceEnvSchema } from './env.schema';
import { buildModelAliases } from './models.config';

@Global()
@Module({})
export class ConfigModule {
  static forService(raw: NodeJS.ProcessEnv): DynamicModule {
    const env = serviceEnvSchema.parse(raw);
    const grafana: GrafanaConfig = { baseUrl: env.GRAFANA_PROM_URL, token: env.GRAFANA_PROM_TOKEN };
    const telegram: TelegramConfig = {
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
    };
    const infra: InfraConfig = {
      databaseUrl: env.DATABASE_URL,
      redisUrl: env.REDIS_URL,
      port: env.PORT,
    };
    const productStats: ProductStatsConfig = { readerDatabaseUrl: env.AI_READER_DATABASE_URL };
    const anthropic: AnthropicConfig = { apiKey: env.ANTHROPIC_API_KEY };
    const changes: ChangesConfig = {
      token: env.GITHUB_READ_TOKEN,
      repository: env.GITHUB_REPOSITORY,
    };
    const happy: HappyConfig = {
      internalUrl: env.HAPPY_INTERNAL_URL,
      serviceToken: env.HAPPY_SERVICE_TOKEN,
      repository: env.GITHUB_REPOSITORY,
    };
    const providers = [
      { provide: ANTHROPIC_CONFIG, useValue: anthropic },
      { provide: GRAFANA_CONFIG, useValue: grafana },
      { provide: PRODUCT_STATS_CONFIG, useValue: productStats },
      { provide: CHANGES_CONFIG, useValue: changes },
      { provide: HAPPY_CONFIG, useValue: happy },
      { provide: TELEGRAM_CONFIG, useValue: telegram },
      { provide: CHAT_CONFIG, useValue: buildChatConfig(env) },
      { provide: INFRA_CONFIG, useValue: infra },
      { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
    ];
    return { module: ConfigModule, providers, exports: providers.map((p) => p.provide) };
  }

  static forPreview(raw: NodeJS.ProcessEnv): DynamicModule {
    const env = previewEnvSchema.parse(raw);
    const grafana: GrafanaConfig = { baseUrl: env.GRAFANA_PROM_URL, token: env.GRAFANA_PROM_TOKEN };
    const productStats: ProductStatsConfig = { readerDatabaseUrl: env.AI_READER_DATABASE_URL };
    const anthropic: AnthropicConfig = { apiKey: env.ANTHROPIC_API_KEY };
    const providers = [
      { provide: ANTHROPIC_CONFIG, useValue: anthropic },
      { provide: GRAFANA_CONFIG, useValue: grafana },
      { provide: PRODUCT_STATS_CONFIG, useValue: productStats },
      { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
    ];
    return { module: ConfigModule, providers, exports: providers.map((p) => p.provide) };
  }
}
