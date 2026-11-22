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
  type ModelAliases,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';

import { ANTHROPIC_CONFIG, MODEL_ALIASES, type AnthropicConfig } from '../config/config.constants';
import { MODEL_ALIAS_NAMES, MODEL_PRICES } from '../config/models.config';

import { AGENT_FOLDER, AGENT_LOOP } from './ai-core.constants';
import { InterruptedRunsRecovery } from './interrupted-runs.recovery';
import { createDigestStubScript } from './stub-digest.script';

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
      provide: AGENT_LOOP,
      inject: [RUN_REPOSITORY, CLOCK_PORT, ANTHROPIC_CONFIG, MODEL_ALIASES],
      useFactory: async (
        runs: RunRepository,
        clock: ClockPort,
        anthropic: AnthropicConfig,
        aliases: ModelAliases,
      ) => {
        const providers = createModelProviders({
          stub: new StubModelAdapter(createDigestStubScript()),
          anthropicApiKey: anthropic.apiKey,
        });
        assertAliasProvidersRegistered(aliases, providers);
        return new AgentLoop({
          providers,
          registry: await ToolRegistry.create([new NativeToolSource([])], []),
          runs,
          clock,
          prices: MODEL_PRICES,
        });
      },
    },
  ],
  exports: [CLOCK_PORT, AGENT_FOLDER, AGENT_LOOP],
})
export class AiCoreModule {}
