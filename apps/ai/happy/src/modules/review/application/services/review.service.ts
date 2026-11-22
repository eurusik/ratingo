import { Inject, Injectable, Logger } from '@nestjs/common';

import { RunStopReason, type RunTrigger } from '@ratingo/ai-core';

import { REVIEW_CONFIG, type ReviewConfig } from '../../../../config/config.constants';
import {
  MAX_CHANGED_FILES,
  MAX_EVIDENCE_FILES,
  MAX_RECHECK_FINDINGS,
  MAX_READ_FILE_BYTES,
  MAX_REVIEWABLE_CHANGED_LINES,
  MAX_TOTAL_PATCH_CHARS,
} from '../../domain/constants/review-limits.constants';
import {
  MIN_REVIEWABLE_CHANGED_LINES,
  type SkipReason,
} from '../../domain/constants/skip-patterns.constants';
import type { ValidatedFinding } from '../../domain/entities/finding';
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
import { CheckOutcome, type Check } from '../../domain/entities/check';
import { RequestedMode, ReviewMode } from '../../domain/entities/review-scope';
import { FindingStatus, type TrackedFinding } from '../../domain/entities/tracked-finding';
import { applyRecheck } from '../../domain/policies/finding-carry-over';
import { mergeTracked } from '../../domain/policies/finding-tracking';
import { validateFindings } from '../../domain/policies/finding-validator';
import {
  buildReleaseChecklist,
  isReleasePullRequest,
} from '../../domain/policies/release-checklist';
import {
  addExtraChecks,
  selectChecks,
  type SelectableFile,
} from '../../domain/policies/check-selector';
import { addedLineTexts } from '../../domain/policies/diff-hunks';
import { rankFiles, type RankedFile } from '../../domain/policies/file-priority';
import { extractRuleSection } from '../../domain/policies/rule-section';
import { renderReleaseChecklist } from '../../domain/policies/release-checklist-renderer';
import { renderCompletedReview, renderSkippedReview } from '../../domain/policies/review-renderer';
import { parseRule, selectRules, type RepoRule } from '../../domain/policies/rule-selector';
import { isSafePath } from '../../domain/policies/safe-path';
import { decideEligibility, decideSkip, reviewableFiles } from '../../domain/policies/skip-policy';
import { CHECK_METRICS_PORT, type CheckMetricsPort } from '../../domain/ports/check-metrics.port';
import { CHECK_SOURCE_PORT, type CheckSourcePort } from '../../domain/ports/check-source.port';
import { CODE_HOST_PORT, type CodeHostPort } from '../../domain/ports/code-host.port';

import { CarryOverService } from './carry-over.service';
import { DeepReviewService, type DeepReviewResult } from './deep-review.service';
import { chooseDiffMode, DiffMode } from './review-prompt';
import { ReviewScopeService, type ScopePlan } from './review-scope.service';
import { TriageService, type TriageResult } from './triage.service';

const buildDiffIndex = (files: readonly ChangedFile[]): Map<string, DiffLines> =>
  new Map(
    files.flatMap((file): [string, DiffLines][] =>
      file.patch === null ? [] : [[file.path, parseDiffLines(file.patch)]],
    ),
  );

const selectableFiles = (files: readonly ChangedFile[]): SelectableFile[] =>
  files.flatMap((file) =>
    file.patch === null ? [] : [{ path: file.path, addedLines: addedLineTexts(file.patch) }],
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

export interface ReviewOptions {
  explicitRequest?: boolean;
  mode?: RequestedMode;
}

const EMPTY_TRIAGE: TriageResult = { focusFiles: [], ruleTopics: [], extraChecks: [], costUsd: 0 };

const EMPTY_DEEP: DeepReviewResult = {
  completed: true,
  stopReason: RunStopReason.END,
  budgetExhausted: false,
  summary: 'Нових змін, які варто переглядати, з минулого рев’ю немає.',
  findings: [],
  recheck: [],
  toolFailures: 0,
  costUsd: 0,
};

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @Inject(CODE_HOST_PORT) private readonly host: CodeHostPort,
    @Inject(REVIEW_CONFIG) private readonly config: ReviewConfig,
    private readonly triage: TriageService,
    private readonly deepReview: DeepReviewService,
    @Inject(CHECK_SOURCE_PORT) private readonly checkSource: CheckSourcePort,
    @Inject(CHECK_METRICS_PORT) private readonly checkMetrics: CheckMetricsPort,
    private readonly scopes: ReviewScopeService,
    private readonly carryOver: CarryOverService,
  ) {}

  async review(
    ref: PullRequestRef,
    trigger: RunTrigger,
    options: ReviewOptions = {},
  ): Promise<ReviewOutcome> {
    this.assertAllowed(ref);
    const pr = await this.host.getPullRequest(ref);
    const { files, truncated } = await this.host.listChangedFiles(ref, {
      maxFiles: MAX_CHANGED_FILES,
      maxPatchChars: MAX_TOTAL_PATCH_CHARS,
    });
    const skipReason = this.skipReasonFor(pr, files, options.explicitRequest === true);
    if (skipReason !== null) {
      this.logger.log(`Skipped ${formatPullRequest(ref)}: ${skipReason}`);
      return skippedOutcome(pr, skipReason);
    }
    if (isReleasePullRequest(pr)) {
      return this.releaseChecklist(pr, files, truncated);
    }

    const plan = await this.scopes.plan(pr, files, options.mode ?? RequestedMode.AUTO);
    const incremental = plan.incrementalFiles !== null;
    const reviewFiles = plan.incrementalFiles ?? files;
    const rules = (await this.host.readRuleFiles(ref, pr.baseSha)).map(parseRule);
    const catalog = this.checkSource.list();
    const preselected = selectChecks(catalog, selectableFiles(reviewFiles));
    const ranked = rankFiles(reviewableFiles(reviewFiles), preselected);
    const carried = await this.carryOver.classify(pr, plan.previous, {
      precise: incremental,
      files: plan.touchedFiles,
    });
    const recheck = carried
      .filter((finding) => finding.status === FindingStatus.NEEDS_RECHECK)
      .slice(0, MAX_RECHECK_FINDINGS);
    const nothingToReview = incremental && ranked.length === 0;
    const triaged = nothingToReview
      ? EMPTY_TRIAGE
      : await this.triage.triage(pr, ranked, trigger, {
          catalog,
          selectedIds: preselected.map((check) => check.id),
        });
    const checks = nothingToReview
      ? []
      : addExtraChecks(
          preselected,
          catalog,
          triaged.extraChecks,
          reviewFiles.map((file) => file.path),
        );
    checks.forEach((check) => this.checkMetrics.record(check.id, CheckOutcome.SELECTED));
    const diffMode = chooseDiffMode(reviewFiles, triaged.focusFiles);
    const deep = nothingToReview
      ? EMPTY_DEEP
      : await this.deepReview.review({
          host: this.host,
          pr,
          files: reviewFiles,
          contextFiles: files,
          history: {
            incremental:
              plan.scope.mode === ReviewMode.INCREMENTAL
                ? { baseSha: plan.scope.baseSha, totalChangedFiles: files.length }
                : null,
            previous: carried.filter((finding) => finding.status !== FindingStatus.RESOLVED),
            recheck,
          },
          focusFiles: triaged.focusFiles,
          appliedRules: selectRules(rules, triaged.focusFiles, triaged.ruleTopics),
          checks,
          ruleSections: this.ruleSectionsFor(checks, rules),
          diffMode,
          allRules: rules,
          trigger,
        });
    return this.completedOutcome({
      pr,
      reviewFiles,
      ranked,
      truncated: truncated || plan.truncated,
      triaged,
      deep,
      diffMode,
      checks,
      plan,
      carried,
      rechecked: recheck,
    });
  }

  private skipReasonFor(
    pr: PullRequest,
    files: readonly ChangedFile[],
    explicitRequest: boolean,
  ): SkipReason | null {
    const limits = {
      allowedAuthors: this.config.allowedAuthors,
      minChangedLines: MIN_REVIEWABLE_CHANGED_LINES,
      maxChangedLines: MAX_REVIEWABLE_CHANGED_LINES,
      explicitRequest,
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

  private ruleSectionsFor(
    checks: readonly Check[],
    rules: readonly RepoRule[],
  ): Map<string, string> {
    const sections = new Map<string, string>();
    for (const check of checks) {
      if (check.rule === null) continue;
      const section = extractRuleSection(rules, check.rule);
      if (section === null) {
        this.logger.warn(
          `Rule ${check.rule.file}${check.rule.heading === null ? '' : `#${check.rule.heading}`} for check ${check.id} was not found; the check stands on its own text`,
        );
      } else {
        sections.set(check.id, section);
      }
    }
    return sections;
  }

  private recordCheckOutcomes(
    findings: readonly ValidatedFinding[],
    questions: readonly ValidatedFinding[],
  ): void {
    for (const { checkId } of findings) {
      if (checkId !== null) this.checkMetrics.record(checkId, CheckOutcome.FINDING);
    }
    for (const { checkId } of questions) {
      if (checkId !== null) this.checkMetrics.record(checkId, CheckOutcome.QUESTION);
    }
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
    ranked: readonly RankedFile[],
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
    const unreviewedFiles = ranked
      .map(({ file }) => file.path)
      .filter((path) => !reviewed.has(path) || !deep.completed);
    return { unreviewedFiles, gaps };
  }

  private async completedOutcome(input: CompletedInput): Promise<CompletedReview> {
    const { pr, reviewFiles, ranked, truncated, triaged, deep, diffMode, checks, plan } = input;
    const evidence = await this.readEvidenceFiles(
      pr,
      deep.findings.map((finding) => finding.evidence.path),
    );
    const validation = validateFindings(
      deep.findings,
      buildDiffIndex(reviewFiles),
      evidence.files,
      {
        selectedChecks: checks,
      },
    );
    this.recordCheckOutcomes(validation.kept, validation.questions);
    for (const { finding, reason, precedent } of validation.dropped) {
      this.logger.warn(
        `Dropped finding ${finding.file}:${finding.line}: ${reason}${precedent === undefined ? '' : ` (${precedent})`}`,
      );
    }
    const asked = new Set(input.rechecked.map((finding) => finding.fingerprint));
    const answers = deep.recheck.filter((answer) => asked.has(answer.fingerprint));
    const tracked = mergeTracked(applyRecheck(input.carried, answers), [
      ...validation.kept,
      ...validation.questions,
    ]);
    const completed = {
      status: deep.completed ? ReviewStatus.REVIEWED : ReviewStatus.INCOMPLETE,
      ref: pr.ref,
      headSha: pr.headSha,
      summary: deep.summary,
      findings: validation.kept,
      questions: validation.questions,
      dropped: validation.dropped,
      tracking: {
        scope: plan.scope,
        reviewedFileCount: reviewFiles.length,
        hadPrevious: plan.previousFound,
        findings: tracked,
      },
      reviewedFiles: triaged.focusFiles,
      coverage: this.coverageFor(ranked, truncated, triaged, deep, diffMode, evidence.failed),
      stopReason: deep.stopReason,
      budgetExhausted: deep.budgetExhausted,
      costUsd: triaged.costUsd + deep.costUsd,
    } as const;
    return { ...completed, markdown: renderCompletedReview(completed) };
  }
}

interface CompletedInput {
  pr: PullRequest;
  reviewFiles: readonly ChangedFile[];
  ranked: readonly RankedFile[];
  truncated: boolean;
  triaged: TriageResult;
  deep: DeepReviewResult;
  diffMode: DiffMode;
  checks: readonly Check[];
  plan: ScopePlan;
  carried: readonly TrackedFinding[];
  rechecked: readonly TrackedFinding[];
}
