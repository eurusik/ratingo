import { Inject, Injectable, Logger } from '@nestjs/common';

import type { RunTrigger } from '@ratingo/ai-core';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';
import {
  MAX_CHANGED_FILES,
  MAX_TOTAL_PATCH_CHARS,
} from '../../domain/constants/review-limits.constants';
import {
  MIN_REVIEWABLE_CHANGED_LINES,
  type SkipReason,
} from '../../domain/constants/skip-patterns.constants';
import type { ChangedFile, PullRequest, PullRequestRef } from '../../domain/entities/pull-request';
import { formatRepository } from '../../domain/entities/pull-request';
import type {
  CompletedReview,
  ReviewOutcome,
  SkippedReview,
} from '../../domain/entities/review-outcome';
import { ReviewStatus } from '../../domain/entities/review-outcome';
import { RepositoryNotAllowedError } from '../../domain/errors/review.errors';
import { parseDiffLines, type DiffLines } from '../../domain/policies/diff-hunks';
import { validateFindings } from '../../domain/policies/finding-validator';
import { renderCompletedReview, renderSkippedReview } from '../../domain/policies/review-renderer';
import { parseRule, selectRules } from '../../domain/policies/rule-selector';
import { decideSkip } from '../../domain/policies/skip-policy';
import { CODE_HOST_PORT, type CodeHostPort } from '../../domain/ports/code-host.port';

import { DeepReviewService, type DeepReviewResult } from './deep-review.service';
import { TriageService, type TriageResult } from './triage.service';

const buildDiffIndex = (files: readonly ChangedFile[]): Map<string, DiffLines> =>
  new Map(
    files.flatMap((file): [string, DiffLines][] =>
      file.patch === null ? [] : [[file.path, parseDiffLines(file.patch)]],
    ),
  );

const skippedOutcome = (ref: PullRequestRef, reason: SkipReason): SkippedReview => {
  const skipped = { status: ReviewStatus.SKIPPED, ref, reason, costUsd: 0 } as const;
  return { ...skipped, markdown: renderSkippedReview(skipped) };
};

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @Inject(CODE_HOST_PORT) private readonly host: CodeHostPort,
    @Inject(REVIEW_CONFIG) private readonly config: ReviewConfig,
    private readonly triage: TriageService,
    private readonly deepReview: DeepReviewService,
  ) {}

  async review(ref: PullRequestRef, trigger: RunTrigger): Promise<ReviewOutcome> {
    this.assertAllowed(ref);
    const pr = await this.host.getPullRequest(ref);
    const { files, truncated } = await this.host.listChangedFiles(ref, {
      maxFiles: MAX_CHANGED_FILES,
      maxPatchChars: MAX_TOTAL_PATCH_CHARS,
    });
    const skipReason = decideSkip(pr, files, {
      allowedAuthors: this.config.allowedAuthors,
      minChangedLines: MIN_REVIEWABLE_CHANGED_LINES,
    });
    if (skipReason !== null) {
      this.logger.log(`Skipped ${formatRepository(ref)}#${ref.number}: ${skipReason}`);
      return skippedOutcome(ref, skipReason);
    }

    const rules = (await this.host.readRuleFiles(ref, pr.baseSha)).map(parseRule);
    const triaged = await this.triage.triage(pr, files, trigger);
    const deep = await this.deepReview.review({
      host: this.host,
      pr,
      files,
      focusFiles: triaged.focusFiles,
      appliedRules: selectRules(rules, triaged.focusFiles, triaged.ruleTopics),
      allRules: rules,
      trigger,
    });
    return this.completedOutcome(pr, files, truncated, triaged, deep);
  }

  private assertAllowed(ref: PullRequestRef): void {
    const repository = formatRepository(ref).toLowerCase();
    const allowed = this.config.allowedRepositories.some(
      (entry) => entry.toLowerCase() === repository,
    );
    if (!allowed) {
      throw new RepositoryNotAllowedError(formatRepository(ref));
    }
  }

  private completedOutcome(
    pr: PullRequest,
    files: readonly ChangedFile[],
    truncated: boolean,
    triaged: TriageResult,
    deep: DeepReviewResult,
  ): CompletedReview {
    const validation = validateFindings(deep.findings, buildDiffIndex(files));
    for (const { finding, reason } of validation.dropped) {
      this.logger.warn(`Dropped finding ${finding.file}:${finding.line}: ${reason}`);
    }
    const completed = {
      status: deep.completed ? ReviewStatus.REVIEWED : ReviewStatus.INCOMPLETE,
      ref: pr.ref,
      headSha: pr.headSha,
      summary: deep.summary,
      findings: validation.kept,
      dropped: validation.dropped,
      reviewedFiles: triaged.focusFiles,
      stopReason: deep.stopReason,
      truncated,
      costUsd: triaged.costUsd + deep.costUsd,
    } as const;
    return { ...completed, markdown: renderCompletedReview(completed) };
  }
}
