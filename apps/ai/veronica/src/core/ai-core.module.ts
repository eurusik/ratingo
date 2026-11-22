import * as path from 'node:path';

import { Global, Module } from '@nestjs/common';

import {
  AgentLoop,
  CLOCK_PORT,
  NativeToolSource,
  RUN_REPOSITORY,
  StubModelAdapter,
  SystemClock,
  ToolRegistry,
  assertAliasProvidersRegistered,
  createModelProviders,
  loadAgentFolder,
  type AgentFolder,
  type ModelProviders,
  type ModelAliases,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';

import { ANTHROPIC_CONFIG, MODEL_ALIASES, type AnthropicConfig } from '../config/config.constants';
import { MODEL_ALIAS_NAMES, MODEL_PRICES } from '../config/models.config';

import {
  AGENT_FOLDER,
  AGENT_LOOP,
  AGENT_LOOP_FACTORY,
  MODEL_PROVIDERS,
  type AgentLoopFactory,
} from './ai-core.constants';
import { InterruptedRunsRecovery } from './interrupted-runs.recovery';
import { createStubScript } from './stub.script';

const AGENT_FOLDER_PATH = path.resolve(__dirname, '../../agent');

@Global()
@Module({
  providers: [
    InterruptedRunsRecovery,
    { provide: CLOCK_PORT, useFactory: (): ClockPort => new SystemClock() },
    {
      provide: AGENT_FOLDER,
      useFactory: (): Promise<AgentFolder> =>
        loadAgentFolder(AGENT_FOLDER_PATH, { knownModelAliases: MODEL_ALIAS_NAMES }),
    },
    {
      provide: MODEL_PROVIDERS,
      inject: [ANTHROPIC_CONFIG, MODEL_ALIASES],
      useFactory: (anthropic: AnthropicConfig, aliases: ModelAliases): ModelProviders => {
        const providers = createModelProviders({
          stub: new StubModelAdapter(createStubScript()),
          anthropicApiKey: anthropic.apiKey,
        });
        assertAliasProvidersRegistered(aliases, providers);
        return providers;
      },
    },
    {
      provide: AGENT_LOOP,
      inject: [MODEL_PROVIDERS, RUN_REPOSITORY, CLOCK_PORT],
      useFactory: async (providers: ModelProviders, runs: RunRepository, clock: ClockPort) =>
        new AgentLoop({
          providers,
          registry: await ToolRegistry.create([new NativeToolSource([])], []),
          runs,
          clock,
          prices: MODEL_PRICES,
        }),
    },
    {
      provide: AGENT_LOOP_FACTORY,
      inject: [MODEL_PROVIDERS, RUN_REPOSITORY, CLOCK_PORT],
      useFactory:
        (providers: ModelProviders, runs: RunRepository, clock: ClockPort): AgentLoopFactory =>
        (registry) =>
          new AgentLoop({ providers, registry, runs, clock, prices: MODEL_PRICES }),
    },
  ],
  exports: [CLOCK_PORT, AGENT_FOLDER, AGENT_LOOP, AGENT_LOOP_FACTORY],
})
export class AiCoreModule {}
