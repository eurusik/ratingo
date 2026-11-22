import { Inject, Injectable, Logger } from '@nestjs/common';

import type { RunTrigger } from '@ratingo/ai-core';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';
import {
  MAX_CHANGED_FILES,
  MAX_EVIDENCE_FILES,
  MAX_READ_FILE_BYTES,
  MAX_REVIEWABLE_CHANGED_LINES,
  MAX_TOTAL_PATCH_CHARS,
} from '../../domain/constants/review-limits.constants';
import {
  MIN_REVIEWABLE_CHANGED_LINES,
  type SkipReason,
} from '../../domain/constants/skip-patterns.constants';
import type { ChangedFile, PullRequest, PullRequestRef } from '../../domain/entities/pull-request';
import { formatPullRequest, formatRepository } from '../../domain/entities/pull-request';
import type {
  CompletedReview,
  ReleaseChecklistReview,
  ReviewCoverage,
  ReviewOutcome,
  SkippedReview,
} from '../../domain/entities/review-outcome';
import { CoverageGap, ReviewStatus } from '../../domain/entities/review-outcome';
import { RepositoryNotAllowedError } from '../../domain/errors/review.errors';
import { parseDiffLines, type DiffLines } from '../../domain/policies/diff-hunks';
import { validateFindings } from '../../domain/policies/finding-validator';
import {
  buildReleaseChecklist,
  isReleasePullRequest,
} from '../../domain/policies/release-checklist';
import { renderReleaseChecklist } from '../../domain/policies/release-checklist-renderer';
import { renderCompletedReview, renderSkippedReview } from '../../domain/policies/review-renderer';
import { parseRule, selectRules } from '../../domain/policies/rule-selector';
import { selectRuleCards } from '../../domain/policies/rule-cards';
import { isSafePath } from '../../domain/policies/safe-path';
import { decideEligibility, decideSkip, reviewableFiles } from '../../domain/policies/skip-policy';
import { CODE_HOST_PORT, type CodeHostPort } from '../../domain/ports/code-host.port';

import { DeepReviewService, type DeepReviewResult } from './deep-review.service';
import { chooseDiffMode, DiffMode } from './review-prompt';
import { TriageService, type TriageResult } from './triage.service';

const buildDiffIndex = (files: readonly ChangedFile[]): Map<string, DiffLines> =>
  new Map(
    files.flatMap((file): [string, DiffLines][] =>
      file.patch === null ? [] : [[file.path, parseDiffLines(file.patch)]],
    ),
  );

const skippedOutcome = (pr: PullRequest, reason: SkipReason): SkippedReview => {
  const skipped = {
    status: ReviewStatus.SKIPPED,
    ref: pr.ref,
    headSha: pr.headSha,
    reason,
    costUsd: 0,
  } as const;
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
    const skipReason = this.skipReasonFor(pr, files);
    if (skipReason !== null) {
      this.logger.log(`Skipped ${formatPullRequest(ref)}: ${skipReason}`);
      return skippedOutcome(pr, skipReason);
    }
    if (isReleasePullRequest(pr)) {
      return this.releaseChecklist(pr, files, truncated);
    }

    const rules = (await this.host.readRuleFiles(ref, pr.baseSha)).map(parseRule);
    const triaged = await this.triage.triage(pr, files, trigger);
    const diffMode = chooseDiffMode(files, triaged.focusFiles);
    const deep = await this.deepReview.review({
      host: this.host,
      pr,
      files,
      focusFiles: triaged.focusFiles,
      appliedRules: selectRules(rules, triaged.focusFiles, triaged.ruleTopics),
      cards: selectRuleCards(triaged.ruleCardIds),
      diffMode,
      allRules: rules,
      trigger,
    });
    return this.completedOutcome(pr, files, truncated, triaged, deep, diffMode);
  }

  private skipReasonFor(pr: PullRequest, files: readonly ChangedFile[]): SkipReason | null {
    const limits = {
      allowedAuthors: this.config.allowedAuthors,
      minChangedLines: MIN_REVIEWABLE_CHANGED_LINES,
      maxChangedLines: MAX_REVIEWABLE_CHANGED_LINES,
    };
    return isReleasePullRequest(pr) ? decideEligibility(pr, limits) : decideSkip(pr, files, limits);
  }

  private releaseChecklist(
    pr: PullRequest,
    files: readonly ChangedFile[],
    truncated: boolean,
  ): ReleaseChecklistReview {
    return {
      status: ReviewStatus.CHECKLIST,
      ref: pr.ref,
      headSha: pr.headSha,
      costUsd: 0,
      markdown: renderReleaseChecklist(pr.ref, pr.headSha, buildReleaseChecklist(files), truncated),
    };
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

  private async readEvidenceFiles(
    pr: PullRequest,
    paths: readonly string[],
  ): Promise<{ files: Map<string, string>; failed: boolean }> {
    const files = new Map<string, string>();
    let failed = false;
    const wanted = [...new Set(paths)].filter(isSafePath).slice(0, MAX_EVIDENCE_FILES);
    await Promise.all(
      wanted.map(async (path) => {
        try {
          const content = await this.host.readFile(pr.ref, path, pr.headSha, {
            maxBytes: MAX_READ_FILE_BYTES,
          });
          if (content !== null) files.set(path, content);
        } catch {
          failed = true;
        }
      }),
    );
    return { files, failed };
  }

  private coverageFor(
    files: readonly ChangedFile[],
    truncated: boolean,
    triaged: TriageResult,
    deep: DeepReviewResult,
    diffMode: DiffMode,
    evidenceFailed: boolean,
  ): ReviewCoverage {
    const reviewed = new Set(triaged.focusFiles);
    const gaps: CoverageGap[] = [
      ...(truncated ? [CoverageGap.LISTING_TRUNCATED] : []),
      ...(deep.completed ? [] : [CoverageGap.STOPPED_EARLY]),
      ...(deep.toolFailures > 0 ? [CoverageGap.TOOL_FAILED] : []),
      ...(diffMode === DiffMode.FILE_LIST ? [CoverageGap.DIFFS_NOT_INLINED] : []),
      ...(evidenceFailed ? [CoverageGap.EVIDENCE_UNREADABLE] : []),
    ];
    const unreviewedFiles = reviewableFiles(files)
      .map((file) => file.path)
      .filter((path) => !reviewed.has(path) || !deep.completed);
    return { unreviewedFiles, gaps };
  }

  private async completedOutcome(
    pr: PullRequest,
    files: readonly ChangedFile[],
    truncated: boolean,
    triaged: TriageResult,
    deep: DeepReviewResult,
    diffMode: DiffMode,
  ): Promise<CompletedReview> {
    const evidence = await this.readEvidenceFiles(
      pr,
      deep.findings.map((finding) => finding.evidence.path),
    );
    const validation = validateFindings(deep.findings, buildDiffIndex(files), evidence.files);
    for (const { finding, reason, precedent } of validation.dropped) {
      this.logger.warn(
        `Dropped finding ${finding.file}:${finding.line}: ${reason}${precedent === undefined ? '' : ` (${precedent})`}`,
      );
    }
    const completed = {
      status: deep.completed ? ReviewStatus.REVIEWED : ReviewStatus.INCOMPLETE,
      ref: pr.ref,
      headSha: pr.headSha,
      summary: deep.summary,
      findings: validation.kept,
      questions: validation.questions,
      dropped: validation.dropped,
      reviewedFiles: triaged.focusFiles,
      coverage: this.coverageFor(files, truncated, triaged, deep, diffMode, evidence.failed),
      stopReason: deep.stopReason,
      costUsd: triaged.costUsd + deep.costUsd,
    } as const;
    return { ...completed, markdown: renderCompletedReview(completed) };
  }
}
