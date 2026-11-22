import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { RunStopReason, type AgentFolder, type RunTrigger } from '@ratingo/ai-core';

import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import { AgentRunner } from '../../../../core/agent-runner.service';
import {
  TRIAGE_BUDGET_USD,
  TRIAGE_MAX_TOKENS_PER_CALL,
  TRIAGE_MAX_TURNS,
  TRIAGE_ROLE,
} from '../../../../config/review.config';
import { MAX_EXTRA_CHECKS, MAX_FOCUS_FILES } from '../../domain/constants/review-limits.constants';
import type { Check, ExtraCheckRequest } from '../../domain/entities/check';
import type { ChangedFile, PullRequest } from '../../domain/entities/pull-request';
import { reviewableFiles } from '../../domain/policies/skip-policy';
import { wrapUntrusted } from '../../domain/policies/untrusted-content';
import { TRIAGE_PROMPT_NAME, TRIAGE_TASK_NAME } from '../../review.constants';

const MAX_RULE_TOPICS = 10;
const MAX_EXTRA_CHECK_REQUESTS = 10;

const renderCheckCatalog = ({ catalog, selectedIds }: TriageChecks): string =>
  `\n\nChecks the code already selected: ${selectedIds.join(', ') || 'none'}.\nYou may add at most ${MAX_EXTRA_CHECKS} more in extraChecks, each as {id, file} where id is from this list and file is a changed file whose diff shows why it applies:\n${catalog.map((check) => `- ${check.id}: ${check.summary}`).join('\n')}`;
const MAX_TOPIC_CHARS = 60;

const triageSchema = z.object({
  risk: z.enum(['low', 'medium', 'high']),
  focusFiles: z.array(z.string()),
  ruleTopics: z.array(z.string()),
  extraChecks: z.array(z.object({ id: z.string(), file: z.string() })).optional(),
});

export interface TriageChecks {
  catalog: readonly Check[];
  selectedIds: readonly string[];
}

export interface TriageResult {
  focusFiles: string[];
  ruleTopics: string[];
  extraChecks: ExtraCheckRequest[];
  costUsd: number;
}

const changeSize = (file: ChangedFile): number => file.additions + file.deletions;

const largestFirst = (files: readonly ChangedFile[]): string[] =>
  [...files]
    .sort((left, right) => changeSize(right) - changeSize(left))
    .slice(0, MAX_FOCUS_FILES)
    .map((file) => file.path);

const buildPrompt = (pr: PullRequest, files: readonly ChangedFile[]): string => {
  const listing = JSON.stringify({
    files: files.map(({ path, status, additions, deletions }) => ({
      path,
      status,
      additions,
      deletions,
    })),
  });
  return [
    wrapUntrusted('pull request title', pr.title),
    wrapUntrusted('changed files', `\`\`\`json\n${listing}\n\`\`\``),
  ].join('\n\n');
};

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    private readonly runner: AgentRunner,
  ) {}

  async triage(
    pr: PullRequest,
    files: readonly ChangedFile[],
    trigger: RunTrigger,
    checks: TriageChecks,
  ): Promise<TriageResult> {
    const candidates = reviewableFiles(files);
    const fallback = largestFirst(candidates);
    const result = await this.runner.run({
      task: TRIAGE_TASK_NAME,
      role: TRIAGE_ROLE,
      trigger,
      system: `${this.folder.prompts[TRIAGE_PROMPT_NAME] ?? ''}${renderCheckCatalog(checks)}`,
      prompt: buildPrompt(pr, candidates),
      responseSchema: triageSchema,
      tools: [],
      budgetUsd: TRIAGE_BUDGET_USD,
      maxTurns: TRIAGE_MAX_TURNS,
      maxTokensPerCall: TRIAGE_MAX_TOKENS_PER_CALL,
    });
    const costUsd = result.run.costUsd;
    if (result.run.stopReason !== RunStopReason.END || result.value === undefined) {
      this.logger.warn(
        `Triage fell back to the largest files: ${result.run.stopReason ?? result.run.status}`,
      );
      return {
        focusFiles: fallback,
        ruleTopics: [],
        extraChecks: [],
        costUsd,
      };
    }
    const reply = result.value as z.infer<typeof triageSchema>;
    const known = new Set(candidates.map((file) => file.path));
    const focusFiles = [...new Set(reply.focusFiles)].filter((path) => known.has(path));
    return {
      focusFiles: focusFiles.length > 0 ? focusFiles.slice(0, MAX_FOCUS_FILES) : fallback,
      ruleTopics: reply.ruleTopics
        .slice(0, MAX_RULE_TOPICS)
        .map((topic) => topic.slice(0, MAX_TOPIC_CHARS)),
      extraChecks: (reply.extraChecks ?? []).slice(0, MAX_EXTRA_CHECK_REQUESTS),
      costUsd,
    };
  }
}
