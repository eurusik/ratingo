import type { PublishedReviewResult } from '../../review/public';
import type { PullReviewState } from '../application/services/internal-review.service';

const toResultResponse = (result: PublishedReviewResult) => ({
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
});

export const toLatestResponse = (state: PullReviewState) =>
  state.status === 'not_found'
    ? { status: 'not_found' as const }
    : {
        status: 'found' as const,
        headSha: state.headSha,
        reviewPending: state.reviewPending ?? false,
        result: state.result === null ? null : toResultResponse(state.result),
      };
