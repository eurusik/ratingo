import { type DynamicModule, Global, Module } from '@nestjs/common';

import {
  GRAFANA_CONFIG,
  INFRA_CONFIG,
  MODEL_ALIASES,
  PRODUCT_STATS_CONFIG,
  TELEGRAM_CONFIG,
  type GrafanaConfig,
  type InfraConfig,
  type ProductStatsConfig,
  type TelegramConfig,
} from './config.constants';
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
    const providers = [
      { provide: GRAFANA_CONFIG, useValue: grafana },
      { provide: PRODUCT_STATS_CONFIG, useValue: productStats },
      { provide: TELEGRAM_CONFIG, useValue: telegram },
      { provide: INFRA_CONFIG, useValue: infra },
      { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
    ];
    return { module: ConfigModule, providers, exports: providers.map((p) => p.provide) };
  }

  static forPreview(raw: NodeJS.ProcessEnv): DynamicModule {
    const env = previewEnvSchema.parse(raw);
    const grafana: GrafanaConfig = { baseUrl: env.GRAFANA_PROM_URL, token: env.GRAFANA_PROM_TOKEN };
    const productStats: ProductStatsConfig = { readerDatabaseUrl: env.AI_READER_DATABASE_URL };
    const providers = [
      { provide: GRAFANA_CONFIG, useValue: grafana },
      { provide: PRODUCT_STATS_CONFIG, useValue: productStats },
      { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
    ];
    return { module: ConfigModule, providers, exports: providers.map((p) => p.provide) };
  }
}
