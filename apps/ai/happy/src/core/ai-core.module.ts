import * as path from 'node:path';

import { Global, Module } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

import {
  CLOCK_PORT,
  InMemoryRunRepository,
  RUN_REPOSITORY,
  StubModelAdapter,
  SystemClock,
  TelemetryRunRepository,
  loadAgentFolder,
  type AgentFolder,
  type ClockPort,
  type ModelAliases,
} from '@ratingo/ai-core';

import { ANTHROPIC_CONFIG, MODEL_ALIASES, type AnthropicConfig } from '../config/config.constants';
import { MODEL_ALIAS_NAMES } from '../config/models.config';

import { AGENT_FOLDER, AI_METER, MODEL_PROVIDERS } from './ai-core.constants';
import { AgentRunner } from './agent-runner.service';
import { NestRunLogger } from './nest-run-logger';
import { assertAliasProvidersRegistered, buildModelProviders } from './model-providers';
import { createReviewStubScript } from './stub-review.script';

const AGENT_FOLDER_PATH = path.resolve(__dirname, '../../agent');
const METER_NAME = 'ratingo-happy';

@Global()
@Module({
  providers: [
    AgentRunner,
    { provide: CLOCK_PORT, useFactory: (): ClockPort => new SystemClock() },
    { provide: AI_METER, useFactory: () => metrics.getMeter(METER_NAME) },
    {
      provide: RUN_REPOSITORY,
      inject: [AI_METER],
      useFactory: (meter: ReturnType<typeof metrics.getMeter>) =>
        new TelemetryRunRepository(meter, new NestRunLogger(), new InMemoryRunRepository()),
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
        const providers = buildModelProviders(
          new StubModelAdapter(createReviewStubScript()),
          anthropic.apiKey,
        );
        assertAliasProvidersRegistered(aliases, providers);
        return providers;
      },
    },
  ],
  exports: [CLOCK_PORT, AGENT_FOLDER, AgentRunner],
})
export class AiCoreModule {}
