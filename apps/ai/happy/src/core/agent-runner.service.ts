import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';

import {
  AgentLoop,
  CLOCK_PORT,
  NativeToolSource,
  RUN_REPOSITORY,
  Run,
  ToolRegistry,
  formatModelRef,
  resolveModelChain,
  type AgentLoopResult,
  type AgentFolder,
  type ClockPort,
  type ModelAliases,
  type ModelProviders,
  type ModelRef,
  type PriorSpend,
  type RunRepository,
  type RunTrigger,
  type Tool,
} from '@ratingo/ai-core';

import { MODEL_ALIASES } from '../config/config.constants';
import { MODEL_PRICES } from '../config/models.config';

import { AGENT_FOLDER, MODEL_PROVIDERS } from './ai-core.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AgentRunRequest {
  task: string;
  role: string;
  trigger: RunTrigger;
  system: string;
  prompt: string;
  responseSchema: ZodType;
  tools: readonly Tool[];
  budgetUsd?: number;
  maxTurns?: number;
  maxTokensPerCall?: number;
}

@Injectable()
export class AgentRunner {
  constructor(
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    @Inject(MODEL_PROVIDERS) private readonly providers: ModelProviders,
    @Inject(MODEL_ALIASES) private readonly aliases: ModelAliases,
    @Inject(RUN_REPOSITORY) private readonly runs: RunRepository,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async run(request: AgentRunRequest): Promise<AgentLoopResult> {
    const { manifest } = this.folder;
    const models = resolveModelChain(manifest.models[request.role] ?? '', this.aliases);
    const registry = await ToolRegistry.create(
      [new NativeToolSource(request.tools)],
      request.tools.map((tool) => tool.name),
    );
    const loop = new AgentLoop({
      providers: this.providers,
      registry,
      runs: this.runs,
      clock: this.clock,
      prices: MODEL_PRICES,
    });
    return loop.run(this.startRun(request, models[0]), {
      models,
      system: request.system,
      prompt: request.prompt,
      responseSchema: request.responseSchema,
      budgets: {
        perRunUsd: Math.min(manifest.budgets.perRunUsd, request.budgetUsd ?? Infinity),
        perDayUsd: manifest.budgets.perDayUsd,
      },
      priorSpend: await this.priorSpend(request.task),
      limits: {
        ...manifest.limits,
        maxTurns: request.maxTurns ?? manifest.limits.maxTurns,
        maxTokensPerCall: request.maxTokensPerCall ?? manifest.limits.maxTokensPerCall,
      },
    });
  }

  private startRun(request: AgentRunRequest, primary: ModelRef | undefined): Run {
    return Run.start(
      {
        id: randomUUID(),
        agent: this.folder.manifest.name,
        task: request.task,
        trigger: request.trigger,
        model: formatModelRef(primary ?? { provider: 'unknown', model: 'unknown' }),
      },
      this.clock,
    );
  }

  private async priorSpend(task: string): Promise<PriorSpend> {
    const agent = this.folder.manifest.name;
    const nowMs = this.clock.nowMs();
    const sinceMs = nowMs - (nowMs % MS_PER_DAY);
    return {
      taskUsd: await this.runs.spentUsd({ agent, task, sinceMs }),
      agentDayUsd: await this.runs.spentUsd({ agent, sinceMs }),
    };
  }
}
