import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  MAX_CHANGED_FILES,
  MAX_TOTAL_PATCH_CHARS,
  PREVIOUS_REVIEW_LOOKBACK,
  SHORT_SHA_LENGTH,
} from '../../domain/constants/review-limits.constants';
import {
  CommitRelation,
  formatPullRequest,
  type ChangedFile,
  type PullRequest,
} from '../../domain/entities/pull-request';
import { ReviewStatus } from '../../domain/entities/review-outcome';
import {
  ComparisonState,
  ReviewMode,
  type RequestedMode,
  type ReviewScope,
} from '../../domain/entities/review-scope';
import type { TrackedFinding } from '../../domain/entities/tracked-finding';
import {
  planReviewScope,
  PreviousReviewKind,
  resolveScope,
  type PreviousReview,
} from '../../domain/policies/review-scope';
import { CODE_HOST_PORT, type CodeHostPort } from '../../domain/ports/code-host.port';
import {
  PUBLISHED_CHECK_PORT,
  type PublishedCheckPort,
} from '../../domain/ports/published-check.port';

export interface ScopePlan {
  scope: ReviewScope;
  previousFound: boolean;
  previous: readonly TrackedFinding[];
  incrementalFiles: ChangedFile[] | null;
  touchedFiles: ChangedFile[];
  truncated: boolean;
}

const NOT_REVIEW_STATUSES: readonly string[] = [ReviewStatus.SKIPPED, ReviewStatus.CHECKLIST];

@Injectable()
export class ReviewScopeService {
  private readonly logger = new Logger(ReviewScopeService.name);

  constructor(
    @Inject(CODE_HOST_PORT) private readonly host: CodeHostPort,
    @Inject(PUBLISHED_CHECK_PORT) private readonly checks: PublishedCheckPort,
  ) {}

  async plan(
    pr: PullRequest,
    files: readonly ChangedFile[],
    requested: RequestedMode,
  ): Promise<ScopePlan> {
    const previous = await this.findPrevious(pr);
    const previousFound = previous.kind === PreviousReviewKind.STATE;
    const carried = previous.kind === PreviousReviewKind.STATE ? previous.findings : [];
    const step = planReviewScope(requested, previous);
    if (step.action === 'full') {
      return {
        scope: { mode: ReviewMode.FULL, reason: step.reason },
        previousFound,
        previous: carried,
        incrementalFiles: null,
        touchedFiles: [],
        truncated: false,
      };
    }
    const comparison = await this.compare(pr, step.baseSha);
    const scope = resolveScope(step.baseSha, comparison.state);
    if (scope.mode === ReviewMode.FULL) {
      return {
        scope,
        previousFound,
        previous: carried,
        incrementalFiles: null,
        touchedFiles: [],
        truncated: false,
      };
    }
    const inPullRequest = new Set(files.map((file) => file.path));
    return {
      scope,
      previousFound,
      previous: carried,
      incrementalFiles: comparison.files.filter((file) => inPullRequest.has(file.path)),
      touchedFiles: comparison.files,
      truncated: comparison.truncated,
    };
  }

  private async compare(
    pr: PullRequest,
    baseSha: string,
  ): Promise<{ state: ComparisonState; files: ChangedFile[]; truncated: boolean }> {
    try {
      const comparison = await this.host.compareCommits(pr.ref, baseSha, pr.headSha, {
        maxFiles: MAX_CHANGED_FILES,
        maxPatchChars: MAX_TOTAL_PATCH_CHARS,
      });
      return {
        state:
          comparison.relation === CommitRelation.AHEAD
            ? ComparisonState.AHEAD
            : ComparisonState.DIVERGED,
        files: comparison.files,
        truncated: comparison.truncated,
      };
    } catch (error) {
      this.logger.warn(
        `Compare ${baseSha.slice(0, SHORT_SHA_LENGTH)}...${pr.headSha.slice(0, SHORT_SHA_LENGTH)} failed for ${formatPullRequest(pr.ref)}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return { state: ComparisonState.FAILED, files: [], truncated: false };
    }
  }

  private async findPrevious(pr: PullRequest): Promise<PreviousReview> {
    const shas = (await this.checks.listRecentCommitShas(pr.ref, PREVIOUS_REVIEW_LOOKBACK)).filter(
      (sha) => sha !== pr.headSha,
    );
    for (const sha of shas) {
      const check = await this.checks.findForCommit(pr.ref, sha);
      if (check === null) continue;
      const snapshot = check.snapshot;
      if (check.trusted && snapshot !== null && NOT_REVIEW_STATUSES.includes(snapshot.status)) {
        continue;
      }
      if (!check.trusted || snapshot === null || snapshot.tracking === null) {
        return { kind: PreviousReviewKind.UNREADABLE };
      }
      return {
        kind: PreviousReviewKind.STATE,
        reviewedSha: check.headSha,
        complete: snapshot.status === ReviewStatus.REVIEWED && snapshot.coverage.complete,
        findings: snapshot.tracking.findings,
      };
    }
    return { kind: PreviousReviewKind.NONE };
  }
}
