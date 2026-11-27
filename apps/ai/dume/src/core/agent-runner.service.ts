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
  type AgentFolder,
  type AgentLoopResult,
  type ClockPort,
  type ModelAliases,
  type ModelProviders,
  type PriorSpend,
  type RunRepository,
  type RunTrigger,
  type Tool,
} from '@ratingo/ai-core';

import { MODEL_ALIASES } from '../config/config.constants';
import { MODEL_PRICES } from '../config/models.config';
import { AGENT_FOLDER, MODEL_PROVIDERS } from './ai-core.constants';
import { utcDayStartMs } from './utc-day';

const DEFAULT_ROLE = 'default';

const INVESTIGATION_TASK = 'investigate';

export interface AgentRunRequest {
  trigger: RunTrigger;
  system: string;
  prompt: string;
  responseSchema: ZodType;
  tools: readonly Tool[];
  finalAnswerPrompt?: string;
  budgetUsd?: number;
  ignoreDailyBudget?: boolean;
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
    const models = resolveModelChain(manifest.models[DEFAULT_ROLE] ?? '', this.aliases);
    const registry = await ToolRegistry.create(
      [new NativeToolSource(request.tools)],
      request.tools.map((tool) => tool.name),
      { guardRepeatedCalls: true },
    );
    const loop = new AgentLoop({
      providers: this.providers,
      registry,
      runs: this.runs,
      clock: this.clock,
      prices: MODEL_PRICES,
    });
    const primary = models[0];
    const run = Run.start(
      {
        id: randomUUID(),
        agent: manifest.name,
        task: INVESTIGATION_TASK,
        trigger: request.trigger,
        model: formatModelRef(primary ?? { provider: 'unknown', model: 'unknown' }),
      },
      this.clock,
    );
    return loop.run(run, {
      models,
      system: request.system,
      prompt: request.prompt,
      responseSchema: request.responseSchema,
      budgets: {
        perRunUsd: Math.min(manifest.budgets.perRunUsd, request.budgetUsd ?? Infinity),
        perDayUsd: request.ignoreDailyBudget === true ? Infinity : manifest.budgets.perDayUsd,
      },
      priorSpend: await this.priorSpend(),
      ...(request.finalAnswerPrompt === undefined
        ? {}
        : { finalAnswer: { prompt: request.finalAnswerPrompt } }),
      limits: manifest.limits,
    });
  }

  private async priorSpend(): Promise<PriorSpend> {
    const agent = this.folder.manifest.name;
    const nowMs = this.clock.nowMs();
    const sinceMs = utcDayStartMs(nowMs);
    return {
      taskUsd: await this.runs.spentUsd({ agent, task: INVESTIGATION_TASK, sinceMs }),
      agentDayUsd: await this.runs.spentUsd({ agent, sinceMs }),
    };
  }
}
