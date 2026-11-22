import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import {
  CLOCK_PORT,
  RUN_REPOSITORY,
  Run,
  RunStatus,
  RunTrigger,
  resolveModelChain,
  type AgentFolder,
  type AgentLoop,
  type ClockPort,
  type ModelAliases,
  type RunRepository,
} from '@ratingo/ai-core';

import { MODEL_ALIASES } from '../../../../config/config.constants';
import { AGENT_FOLDER, AGENT_LOOP } from '../../../../core/ai-core.constants';
import { DIGEST_TASK_NAME } from '../../digest.constants';
import { DigestLevel } from '../../domain/constants/digest-level.constants';
import type { Digest, DigestItem, DigestText } from '../../domain/entities/digest';

const HEADLINE_MAX = 120;
const LINE_MAX = 300;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DIGIT = /\d/;
const ACTIONS_MAX = 20;

const replySchema = z.object({
  headline: z.string().min(1).max(HEADLINE_MAX),
  actions: z
    .array(z.object({ id: z.string(), text: z.string().min(1).max(LINE_MAX) }))
    .max(ACTIONS_MAX),
  interesting: z.string().min(1).max(LINE_MAX).optional(),
});

export interface DigestTextResult {
  text: DigestText | null;
  costUsd: number | null;
  runId: string | null;
}

const NO_TEXT: DigestTextResult = { text: null, costUsd: null, runId: null };

const trendOf = (current: number, baseline: number | null): string => {
  if (baseline === null || current === baseline) return 'так само';
  return current > baseline ? 'більше' : 'менше';
};

const buildFacts = (digest: Digest) => ({
  verdict: digest.level,
  items: digest.blocks
    .flatMap((block) => block.items)
    .filter((item) => item.level !== DigestLevel.OK)
    .map((item: DigestItem) => ({
      id: item.id,
      block: item.block,
      level: item.level,
      advice: item.advice,
    })),
  trends: digest.blocks
    .flatMap((block) => block.facts)
    .map((fact) => ({ label: fact.label, trend: trendOf(fact.current, fact.baseline) })),
  sources: digest.sources.map((status) => ({ source: status.source, state: status.state })),
});

const hasDigits = (value: string): boolean => DIGIT.test(value);

@Injectable()
export class DigestTextService {
  private readonly logger = new Logger(DigestTextService.name);

  constructor(
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    @Inject(AGENT_LOOP) private readonly loop: AgentLoop,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(RUN_REPOSITORY) private readonly runs: RunRepository,
    @Inject(MODEL_ALIASES) private readonly aliases: ModelAliases,
  ) {}

  async write(digest: Digest, trigger: RunTrigger): Promise<DigestTextResult> {
    try {
      return await this.runModel(digest, trigger);
    } catch (error) {
      this.logger.warn(
        `Текст від моделі недоступний: ${error instanceof Error ? error.name : 'помилка'}`,
      );
      return NO_TEXT;
    }
  }

  private async runModel(digest: Digest, trigger: RunTrigger): Promise<DigestTextResult> {
    const task = this.folder.tasks.find((candidate) => candidate.name === DIGEST_TASK_NAME);
    if (task === undefined) {
      return NO_TEXT;
    }
    const { manifest, prompts } = this.folder;
    const alias = task.frontmatter.model ?? manifest.models.default;
    const nowMs = this.clock.nowMs();
    const sinceMs = nowMs - MS_PER_DAY;
    const run = Run.start(
      { id: randomUUID(), agent: manifest.name, task: task.name, trigger, model: alias },
      this.clock,
    );
    const result = await this.loop.run(run, {
      models: resolveModelChain(alias, this.aliases),
      system: prompts.system ?? '',
      prompt: [
        task.body,
        prompts['digest-text'] ?? '',
        `\`\`\`json\n${JSON.stringify(buildFacts(digest))}\n\`\`\``,
      ].join('\n\n'),
      responseSchema: replySchema,
      budgets: {
        perRunUsd: manifest.budgets.perRunUsd,
        perDayUsd: manifest.budgets.perDayUsd,
        ...(task.frontmatter.budgetUsd === undefined
          ? {}
          : { perTaskUsd: task.frontmatter.budgetUsd }),
      },
      priorSpend: {
        taskUsd: await this.runs.spentUsd({ agent: manifest.name, task: task.name, sinceMs }),
        agentDayUsd: await this.runs.spentUsd({ agent: manifest.name, sinceMs }),
      },
      limits: {
        ...manifest.limits,
        maxTurns: task.frontmatter.maxTurns ?? manifest.limits.maxTurns,
      },
    });
    const costUsd = result.run.costUsd;
    if (result.run.status !== RunStatus.COMPLETED) {
      this.logger.warn(
        `Запуск моделі ${result.run.id} завершився так: ${result.run.stopReason ?? result.run.status}`,
      );
      return { text: null, costUsd, runId: result.run.id };
    }
    return {
      text: this.sanitize(replySchema.parse(result.value), digest),
      costUsd,
      runId: result.run.id,
    };
  }

  private sanitize(reply: z.infer<typeof replySchema>, digest: Digest): DigestText | null {
    if (hasDigits(reply.headline)) {
      return null;
    }
    const actionIds = new Set(
      digest.blocks
        .flatMap((block) => block.items)
        .filter((i) => i.level === DigestLevel.ACTION)
        .map((i) => i.id),
    );
    return {
      headline: reply.headline,
      adviceById: Object.fromEntries(
        reply.actions
          .filter((action) => actionIds.has(action.id) && !hasDigits(action.text))
          .map((action) => [action.id, action.text]),
      ),
      ...(reply.interesting !== undefined && !hasDigits(reply.interesting)
        ? { interesting: reply.interesting }
        : {}),
    };
  }
}
