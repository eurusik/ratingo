import * as path from 'node:path';

import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { metrics, type Meter } from '@opentelemetry/api';
import Redis from 'ioredis';

import {
  CLOCK_PORT,
  RUN_REPOSITORY,
  StubModelAdapter,
  SystemClock,
  assertAliasProvidersRegistered,
  createModelProviders,
  loadAgentFolder,
  type AgentFolder,
  type ClockPort,
  type ModelAliases,
} from '@ratingo/ai-core';

import {
  ANTHROPIC_CONFIG,
  MODEL_ALIASES,
  REDIS_CONFIG,
  type AnthropicConfig,
  type RedisConfig,
} from '../config/config.constants';
import { MODEL_ALIAS_NAMES } from '../config/models.config';

import { AGENT_FOLDER, AI_METER, MODEL_PROVIDERS, SPEND_REDIS } from './ai-core.constants';
import { AgentRunner } from './agent-runner.service';
import { NestRunLogger, NestSpendLogger } from './nest-run-logger';
import { createRunRepository } from './run-repository.factory';
import { createReviewStubScript } from './stub-review.script';

const AGENT_FOLDER_PATH = path.resolve(__dirname, '../../agent');
const METER_NAME = 'ratingo-happy';
const REDIS_COMMAND_TIMEOUT_MS = 2_000;
const spendLogger = new NestSpendLogger();

@Global()
@Module({
  providers: [
    AgentRunner,
    { provide: CLOCK_PORT, useFactory: (): ClockPort => new SystemClock() },
    { provide: AI_METER, useFactory: () => metrics.getMeter(METER_NAME) },
    {
      provide: SPEND_REDIS,
      inject: [REDIS_CONFIG],
      useFactory: (config: RedisConfig): Redis | null =>
        config.url === undefined
          ? null
          : new Redis(config.url, {
              commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
              maxRetriesPerRequest: 1,
            }).on('error', (error: Error) => spendLogger.warn(`Redis error: ${error.message}`)),
    },
    {
      provide: RUN_REPOSITORY,
      inject: [AI_METER, CLOCK_PORT, SPEND_REDIS],
      useFactory: (meter: Meter, clock: ClockPort, redis: Redis | null) =>
        createRunRepository({
          meter,
          clock,
          runLogger: new NestRunLogger(),
          spendLogger,
          redis,
        }),
    },
    {
      provide: AGENT_FOLDER,
      useFactory: (): Promise<AgentFolder> =>
        loadAgentFolder(AGENT_FOLDER_PATH, { knownModelAliases: MODEL_ALIAS_NAMES }),
    },
    {
      provide: MODEL_PROVIDERS,
      inject: [ANTHROPIC_CONFIG, MODEL_ALIASES],
      useFactory: (anthropic: AnthropicConfig, aliases: ModelAliases) => {
        const providers = createModelProviders({
          stub: new StubModelAdapter(createReviewStubScript()),
          anthropicApiKey: anthropic.apiKey,
        });
        assertAliasProvidersRegistered(aliases, providers);
        return providers;
      },
    },
  ],
  exports: [CLOCK_PORT, AGENT_FOLDER, AgentRunner],
})
export class AiCoreModule implements OnModuleDestroy {
  constructor(@Inject(SPEND_REDIS) private readonly redis: Redis | null) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => this.redis?.disconnect());
  }
}
