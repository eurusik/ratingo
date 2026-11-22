import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  BudgetLevel,
  RunStopReason,
  type AgentFolder,
  type RunTrigger,
  type Tool,
} from '@ratingo/ai-core';

import { REVIEW_ROLE } from '../../../../config/review.config';
import { AgentRunner } from '../../../../core/agent-runner.service';
import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import {
  MAX_FINDING_MESSAGE_CHARS,
  MAX_FINDING_SUGGESTION_CHARS,
  MAX_SUMMARY_CHARS,
} from '../../domain/constants/review-limits.constants';
import {
  FINDING_KINDS,
  FINDING_TOPICS,
} from '../../domain/constants/finding-classification.constants';
import {
  MAX_EVIDENCE_EXCERPT_CHARS,
  MAX_GATE_TEXT_CHARS,
} from '../../domain/constants/review-limits.constants';
import { FINDING_CATEGORIES, FINDING_SEVERITIES } from '../../domain/constants/severity.constants';
import type { Check } from '../../domain/entities/check';
import type { Finding } from '../../domain/entities/finding';
import { RecheckVerdict, type RecheckAnswer } from '../../domain/entities/tracked-finding';
import type { ChangedFile, PullRequest } from '../../domain/entities/pull-request';
import type { RepoRule } from '../../domain/policies/rule-selector';
import type { CodeHostPort } from '../../domain/ports/code-host.port';
import { REVIEW_PROMPT_NAME, REVIEW_TASK_NAME } from '../../review.constants';
import { createReviewTools } from '../tools/create-review-tools';

import {
  buildReviewPrompt,
  buildReviewSystem,
  type DiffMode,
  type PromptHistory,
  type RuleSections,
} from './review-prompt';

const MAX_RAW_FINDINGS = 40;

const reviewSchema = z.object({
  summary: z.string(),
  recheck: z
    .array(
      z.object({
        fingerprint: z.string(),
        verdict: z.enum([RecheckVerdict.RESOLVED, RecheckVerdict.STILL_OPEN]),
      }),
    )
    .optional(),
  findings: z.array(
    z.object({
      file: z.string(),
      line: z.number().int().positive(),
      severity: z.enum(FINDING_SEVERITIES),
      category: z.enum(FINDING_CATEGORIES),
      topic: z.enum(FINDING_TOPICS),
      kind: z.enum(FINDING_KINDS),
      checkId: z.string().nullable(),
      failureScenario: z.string(),
      impact: z.string(),
      message: z.string(),
      suggestion: z.string().optional(),
      evidence: z.object({
        path: z.string(),
        line: z.number().int().positive(),
        excerpt: z.string(),
      }),
    }),
  ),
});

export interface DeepReviewInput {
  host: CodeHostPort;
  pr: PullRequest;
  files: readonly ChangedFile[];
  contextFiles: readonly ChangedFile[];
  history: PromptHistory;
  focusFiles: readonly string[];
  appliedRules: readonly RepoRule[];
  checks: readonly Check[];
  ruleSections: RuleSections;
  diffMode: DiffMode;
  allRules: readonly RepoRule[];
  trigger: RunTrigger;
}

export interface DeepReviewResult {
  completed: boolean;
  stopReason: string;
  budgetExhausted: boolean;
  summary: string;
  findings: Finding[];
  recheck: RecheckAnswer[];
  toolFailures: number;
  costUsd: number;
}

const clip = (text: string, limit: number): string => text.slice(0, limit);

const countingFailures = (tools: readonly Tool[], failures: { count: number }): Tool[] =>
  tools.map((tool) => ({
    ...tool,
    run: async (rawInput, context) => {
      try {
        return await tool.run(rawInput, context);
      } catch (error) {
        failures.count += 1;
        throw error;
      }
    },
  }));

@Injectable()
export class DeepReviewService {
  constructor(
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    private readonly runner: AgentRunner,
  ) {}

  async review(input: DeepReviewInput): Promise<DeepReviewResult> {
    const failures = { count: 0 };
    const result = await this.runner.run({
      task: REVIEW_TASK_NAME,
      role: REVIEW_ROLE,
      trigger: input.trigger,
      system: buildReviewSystem(
        this.folder.prompts[REVIEW_PROMPT_NAME] ?? '',
        input.appliedRules,
        input.checks,
        input.ruleSections,
      ),
      prompt: buildReviewPrompt(
        input.pr,
        input.files,
        input.focusFiles,
        input.diffMode,
        input.history,
      ),
      responseSchema: reviewSchema,
      tools: countingFailures(
        createReviewTools({
          host: input.host,
          pr: input.pr,
          files: input.contextFiles,
          rules: input.allRules,
        }),
        failures,
      ),
    });
    const stopReason = result.run.stopReason ?? result.run.status;
    const costUsd = result.run.costUsd;
    const budgetExhausted =
      stopReason === RunStopReason.BUDGET_EXCEEDED &&
      result.run.stopDetail === BudgetLevel.AGENT_DAY;
    if (stopReason !== RunStopReason.END || result.value === undefined) {
      return {
        completed: false,
        stopReason,
        budgetExhausted,
        summary: '',
        findings: [],
        recheck: [],
        toolFailures: failures.count,
        costUsd,
      };
    }
    const reply = result.value as z.infer<typeof reviewSchema>;
    return {
      completed: true,
      stopReason,
      budgetExhausted,
      summary: clip(reply.summary, MAX_SUMMARY_CHARS),
      findings: reply.findings.slice(0, MAX_RAW_FINDINGS).map(({ suggestion, ...finding }) => ({
        ...finding,
        message: clip(finding.message, MAX_FINDING_MESSAGE_CHARS),
        failureScenario: clip(finding.failureScenario, MAX_GATE_TEXT_CHARS),
        impact: clip(finding.impact, MAX_GATE_TEXT_CHARS),
        evidence: {
          ...finding.evidence,
          excerpt: clip(finding.evidence.excerpt, MAX_EVIDENCE_EXCERPT_CHARS),
        },
        ...(suggestion === undefined
          ? {}
          : { suggestion: clip(suggestion, MAX_FINDING_SUGGESTION_CHARS) }),
      })),
      recheck: reply.recheck ?? [],
      toolFailures: failures.count,
      costUsd,
    };
  }
}
