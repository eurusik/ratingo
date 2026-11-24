import {
  HappyResultKind,
  HappyResultStatus,
  HappyReviewMode,
  HappyScopeMode,
  type HappyResult,
} from '../entities/happy';

const cannotHaveReviewScope = (result: HappyResult): boolean =>
  result.kind === HappyResultKind.RELEASE_CHECKLIST || result.status === HappyResultStatus.SKIPPED;

export const satisfiesReviewMode = (result: HappyResult, mode: HappyReviewMode): boolean =>
  mode === HappyReviewMode.AUTO ||
  cannotHaveReviewScope(result) ||
  result.review?.mode === HappyScopeMode.FULL;
