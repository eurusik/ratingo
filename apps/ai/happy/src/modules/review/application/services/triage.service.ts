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
import {
  MAX_EXTRA_CHECKS,
  MAX_FOCUS_FILES,
  MAX_INLINE_DIFF_CHANGED_LINES,
} from '../../domain/constants/review-limits.constants';
import type { Check, ExtraCheckRequest } from '../../domain/entities/check';
import type { PullRequest } from '../../domain/entities/pull-request';
import {
  selectFocusFiles,
  type FocusLimits,
  type RankedFile,
} from '../../domain/policies/file-priority';
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

const FOCUS_LIMITS: FocusLimits = {
  maxFiles: MAX_FOCUS_FILES,
  maxInlineChangedLines: MAX_INLINE_DIFF_CHANGED_LINES,
};

const buildPrompt = (pr: PullRequest, ranked: readonly RankedFile[]): string => {
  const listing = JSON.stringify({
    files: ranked.map(({ file: { path, status, additions, deletions }, tier }) => ({
      path,
      tier,
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
    ranked: readonly RankedFile[],
    trigger: RunTrigger,
    checks: TriageChecks,
  ): Promise<TriageResult> {
    const result = await this.runner.run({
      task: TRIAGE_TASK_NAME,
      role: TRIAGE_ROLE,
      trigger,
      system: `${this.folder.prompts[TRIAGE_PROMPT_NAME] ?? ''}${renderCheckCatalog(checks)}`,
      prompt: buildPrompt(pr, ranked),
      responseSchema: triageSchema,
      tools: [],
      budgetUsd: TRIAGE_BUDGET_USD,
      maxTurns: TRIAGE_MAX_TURNS,
      maxTokensPerCall: TRIAGE_MAX_TOKENS_PER_CALL,
    });
    const costUsd = result.run.costUsd;
    if (result.run.stopReason !== RunStopReason.END || result.value === undefined) {
      this.logger.warn(
        `Triage fell back to the ranked files: ${result.run.stopReason ?? result.run.status}`,
      );
      return {
        focusFiles: selectFocusFiles(ranked, [], FOCUS_LIMITS),
        ruleTopics: [],
        extraChecks: [],
        costUsd,
      };
    }
    const reply = result.value as z.infer<typeof triageSchema>;
    const known = new Set(ranked.map(({ file }) => file.path));
    const suggested = [...new Set(reply.focusFiles)].filter((path) => known.has(path));
    return {
      focusFiles: selectFocusFiles(ranked, suggested, FOCUS_LIMITS),
      ruleTopics: reply.ruleTopics
        .slice(0, MAX_RULE_TOPICS)
        .map((topic) => topic.slice(0, MAX_TOPIC_CHARS)),
      extraChecks: (reply.extraChecks ?? []).slice(0, MAX_EXTRA_CHECK_REQUESTS),
      costUsd,
    };
  }
}
