import { type DynamicModule, Global, Module } from '@nestjs/common';

import {
  ANTHROPIC_CONFIG,
  MODEL_ALIASES,
  REDIS_CONFIG,
  SNAPSHOT_CONFIG,
  type AnthropicConfig,
  type RedisConfig,
  type SnapshotConfig,
} from './config.constants';
import { envSchema } from './env.schema';
import { buildModelAliases } from './models.config';

@Global()
@Module({})
export class ConfigModule {
  static forEnvironment(raw: NodeJS.ProcessEnv): DynamicModule {
    const env = envSchema.parse(raw);
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
    const providers = [
      { provide: ANTHROPIC_CONFIG, useValue: anthropic },
      { provide: REDIS_CONFIG, useValue: redis },
      { provide: SNAPSHOT_CONFIG, useValue: snapshot },
      { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
    ];
    return {
      module: ConfigModule,
      providers,
      exports: providers.map((provider) => provider.provide),
    };
  }
}
