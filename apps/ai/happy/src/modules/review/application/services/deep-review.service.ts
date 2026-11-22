import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { RunStopReason, type AgentFolder, type RunTrigger } from '@ratingo/ai-core';

import { REVIEW_ROLE } from '../../../../config/review.config';
import { AgentRunner } from '../../../../core/agent-runner.service';
import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import {
  MAX_FINDING_MESSAGE_CHARS,
  MAX_FINDING_SUGGESTION_CHARS,
  MAX_SUMMARY_CHARS,
} from '../../domain/constants/review-limits.constants';
import { FINDING_CATEGORIES, FINDING_SEVERITIES } from '../../domain/constants/severity.constants';
import type { Finding } from '../../domain/entities/finding';
import type { ChangedFile, PullRequest } from '../../domain/entities/pull-request';
import type { RepoRule } from '../../domain/policies/rule-selector';
import type { CodeHostPort } from '../../domain/ports/code-host.port';
import { REVIEW_PROMPT_NAME, REVIEW_TASK_NAME } from '../../review.constants';
import { createReviewTools } from '../tools/create-review-tools';

import { buildReviewPrompt, buildReviewSystem } from './review-prompt';

const MAX_RAW_FINDINGS = 40;

const reviewSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      file: z.string(),
      line: z.number().int().positive(),
      severity: z.enum(FINDING_SEVERITIES),
      category: z.enum(FINDING_CATEGORIES),
      message: z.string(),
      suggestion: z.string().optional(),
    }),
  ),
});

export interface DeepReviewInput {
  host: CodeHostPort;
  pr: PullRequest;
  files: readonly ChangedFile[];
  focusFiles: readonly string[];
  appliedRules: readonly RepoRule[];
  allRules: readonly RepoRule[];
  trigger: RunTrigger;
}

export interface DeepReviewResult {
  completed: boolean;
  stopReason: string;
  summary: string;
  findings: Finding[];
  costUsd: number;
}

const clip = (text: string, limit: number): string => text.slice(0, limit);

@Injectable()
export class DeepReviewService {
  constructor(
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    private readonly runner: AgentRunner,
  ) {}

  async review(input: DeepReviewInput): Promise<DeepReviewResult> {
    const result = await this.runner.run({
      task: REVIEW_TASK_NAME,
      role: REVIEW_ROLE,
      trigger: input.trigger,
      system: buildReviewSystem(this.folder.prompts[REVIEW_PROMPT_NAME] ?? '', input.appliedRules),
      prompt: buildReviewPrompt(input.pr, input.files, input.focusFiles),
      responseSchema: reviewSchema,
      tools: createReviewTools({
        host: input.host,
        pr: input.pr,
        files: input.files,
        rules: input.allRules,
      }),
    });
    const stopReason = result.run.stopReason ?? result.run.status;
    const costUsd = result.run.costUsd;
    if (stopReason !== RunStopReason.END || result.value === undefined) {
      return { completed: false, stopReason, summary: '', findings: [], costUsd };
    }
    const reply = result.value as z.infer<typeof reviewSchema>;
    return {
      completed: true,
      stopReason,
      summary: clip(reply.summary, MAX_SUMMARY_CHARS),
      findings: reply.findings.slice(0, MAX_RAW_FINDINGS).map(({ suggestion, ...finding }) => ({
        ...finding,
        message: clip(finding.message, MAX_FINDING_MESSAGE_CHARS),
        ...(suggestion === undefined
          ? {}
          : { suggestion: clip(suggestion, MAX_FINDING_SUGGESTION_CHARS) }),
      })),
      costUsd,
    };
  }
}
