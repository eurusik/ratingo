import type { PublishedReviewResult, ResultTracking } from '../../review/public';
import type { PullReviewState } from '../application/services/internal-review.service';

const toReviewResponse = (tracking: ResultTracking | null) =>
  tracking === null
    ? null
    : {
        mode: tracking.scope.mode,
        baseSha: tracking.scope.baseSha,
        fullReason: tracking.scope.reason,
        files: tracking.scope.files,
        statusCounts: tracking.counts,
      };

const toResultResponse = (result: PublishedReviewResult) => ({
  kind: result.kind,
  status: result.status,
  checkedSha: result.checkedSha,
  current: result.current,
  title: result.title,
  summary: result.summary,
  skipReason: result.skipReason,
  counts: result.counts,
  questions: result.questions,
  coverage: result.coverage,
  checkRunUrl: result.checkRunUrl,
  review: toReviewResponse(result.tracking),
});

export const toLatestResponse = (state: PullReviewState) =>
  state.status === 'not_found'
    ? { status: 'not_found' as const }
    : {
        status: 'found' as const,
        headSha: state.headSha,
        baseBranch: state.baseBranch,
        headBranch: state.headBranch,
        reviewPending: state.reviewPending ?? false,
        result: state.result === null ? null : toResultResponse(state.result),
      };
