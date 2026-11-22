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
  loadAgentFolder,
  type AgentFolder,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';

import { MODEL_ALIAS_NAMES, MODEL_PRICES, STUB_PROVIDER } from '../config/models.config';

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
      inject: [RUN_REPOSITORY, CLOCK_PORT],
      useFactory: async (runs: RunRepository, clock: ClockPort) =>
        new AgentLoop({
          providers: { [STUB_PROVIDER]: new StubModelAdapter(createDigestStubScript()) },
          registry: await ToolRegistry.create([new NativeToolSource([])], []),
          runs,
          clock,
          prices: MODEL_PRICES,
        }),
    },
  ],
  exports: [CLOCK_PORT, AGENT_FOLDER, AGENT_LOOP],
})
export class AiCoreModule {}
