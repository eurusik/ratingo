import { type DynamicModule, Global, Module } from '@nestjs/common';

import {
  ANTHROPIC_CONFIG,
  MODEL_ALIASES,
  OPS_CONFIG,
  REDIS_CONFIG,
  SERVICE_CONFIG,
  SNAPSHOT_CONFIG,
  type AnthropicConfig,
  type OpsConfig,
  type RedisConfig,
  type ServiceConfig,
  type SnapshotConfig,
} from './config.constants';
import { envSchema, serviceEnvSchema } from './env.schema';
import { buildModelAliases } from './models.config';

type CommonEnv = ReturnType<typeof envSchema.parse>;

const commonProviders = (env: CommonEnv): { provide: symbol; useValue: unknown }[] => {
  const anthropic: AnthropicConfig = { apiKey: env.ANTHROPIC_API_KEY };
  const redis: RedisConfig = { url: env.REDIS_URL };
  const snapshot: SnapshotConfig =
    env.DUME_LOCAL_CHECKOUT === undefined
      ? {
          kind: 'github',
          repository: env.GITHUB_REPOSITORY,
          apiUrl: env.GITHUB_API_URL,
          ...(env.GITHUB_READ_TOKEN === undefined ? {} : { token: env.GITHUB_READ_TOKEN }),
        }
      : { kind: 'local', root: env.DUME_LOCAL_CHECKOUT };
  const ops: OpsConfig = {
    loki: {
      baseUrl: env.GRAFANA_LOKI_URL,
      user: env.GRAFANA_LOKI_USER,
      token: env.GRAFANA_LOKI_TOKEN,
    },
    prometheus: { baseUrl: env.GRAFANA_PROM_URL, token: env.GRAFANA_PROM_TOKEN },
    readerDatabaseUrl: env.AI_READER_DATABASE_URL,
    explorerDatabaseUrl: env.AI_EXPLORER_DATABASE_URL,
  };
  return [
    { provide: OPS_CONFIG, useValue: ops },
    { provide: ANTHROPIC_CONFIG, useValue: anthropic },
    { provide: REDIS_CONFIG, useValue: redis },
    { provide: SNAPSHOT_CONFIG, useValue: snapshot },
    { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
  ];
};

const exportProviders = (providers: { provide: symbol; useValue: unknown }[]): DynamicModule => ({
  module: ConfigModule,
  providers,
  exports: providers.map((provider) => provider.provide),
});

@Global()
@Module({})
export class ConfigModule {
  static forEnvironment(raw: NodeJS.ProcessEnv): DynamicModule {
    return exportProviders(commonProviders(envSchema.parse(raw)));
  }

  static forService(raw: NodeJS.ProcessEnv): DynamicModule {
    const env = serviceEnvSchema.parse(raw);
    const service: ServiceConfig = {
      port: env.PORT,
      maxInvestigationsPerDay: env.DUME_MAX_INVESTIGATIONS_PER_DAY,
      ...(env.DUME_SERVICE_TOKEN === undefined ? {} : { serviceToken: env.DUME_SERVICE_TOKEN }),
    };
    return exportProviders([
      ...commonProviders(env),
      { provide: SERVICE_CONFIG, useValue: service },
    ]);
  }
}
