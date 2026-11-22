import { type DynamicModule, Global, Module } from '@nestjs/common';

import {
  ANTHROPIC_CONFIG,
  GITHUB_CONFIG,
  INFRA_CONFIG,
  MODEL_ALIASES,
  REDIS_CONFIG,
  REVIEW_CONFIG,
  WEBHOOK_CONFIG,
  type AnthropicConfig,
  type GithubConfig,
  type InfraConfig,
  type RedisConfig,
  type ReviewConfig,
  type WebhookConfig,
} from './config.constants';
import { DEFAULT_MENTION_HANDLE } from '../modules/webhook/domain/constants/webhook.constants';

import { cliEnvSchema, serviceEnvSchema } from './env.schema';
import { buildModelAliases } from './models.config';

const exportProviders = (providers: { provide: symbol; useValue: unknown }[]): DynamicModule => ({
  module: ConfigModule,
  providers,
  exports: providers.map((provider) => provider.provide),
});

@Global()
@Module({})
export class ConfigModule {
  static forService(raw: NodeJS.ProcessEnv): DynamicModule {
    const env = serviceEnvSchema.parse(raw);
    const github: GithubConfig = {
      auth: {
        kind: 'app',
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      },
      apiUrl: env.GITHUB_API_URL,
    };
    const webhook: WebhookConfig = { secret: env.GITHUB_WEBHOOK_SECRET };
    const anthropic: AnthropicConfig = { apiKey: env.ANTHROPIC_API_KEY };
    const infra: InfraConfig = { port: env.PORT };
    const redis: RedisConfig = { url: env.REDIS_URL };
    const review: ReviewConfig = {
      allowedRepositories: env.HAPPY_ALLOWED_REPOS,
      allowedAuthors: env.HAPPY_ALLOWED_AUTHORS,
      mentionHandle: env.HAPPY_MENTION_HANDLE,
      serviceToken: env.HAPPY_SERVICE_TOKEN,
    };
    return exportProviders([
      { provide: GITHUB_CONFIG, useValue: github },
      { provide: WEBHOOK_CONFIG, useValue: webhook },
      { provide: ANTHROPIC_CONFIG, useValue: anthropic },
      { provide: INFRA_CONFIG, useValue: infra },
      { provide: REVIEW_CONFIG, useValue: review },
      { provide: REDIS_CONFIG, useValue: redis },
      { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
    ]);
  }

  static forCli(raw: NodeJS.ProcessEnv, repository: string): DynamicModule {
    const env = cliEnvSchema.parse(raw);
    const github: GithubConfig = {
      auth: { kind: 'token', token: env.GITHUB_TOKEN },
      apiUrl: env.GITHUB_API_URL,
    };
    const anthropic: AnthropicConfig = { apiKey: env.ANTHROPIC_API_KEY };
    const review: ReviewConfig = {
      allowedRepositories: [repository],
      allowedAuthors: env.HAPPY_ALLOWED_AUTHORS,
      mentionHandle: DEFAULT_MENTION_HANDLE,
    };
    const redis: RedisConfig = { url: env.REDIS_URL };
    return exportProviders([
      { provide: GITHUB_CONFIG, useValue: github },
      { provide: ANTHROPIC_CONFIG, useValue: anthropic },
      { provide: REVIEW_CONFIG, useValue: review },
      { provide: REDIS_CONFIG, useValue: redis },
      { provide: MODEL_ALIASES, useValue: buildModelAliases(env) },
    ]);
  }
}
