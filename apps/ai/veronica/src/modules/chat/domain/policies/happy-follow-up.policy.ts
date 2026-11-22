import {
  HAPPY_FOLLOW_UP_MAX_ATTEMPTS,
  HAPPY_FOLLOW_UP_MIN_ATTEMPTS_BEFORE_NOT_PUBLISHED,
  HappyFollowUpAction,
} from '../constants/happy.constants';
import {
  HappyLookupKind,
  HappyReviewMode,
  HappyScopeMode,
  type HappyFollowUp,
  type HappyLookup,
} from '../entities/happy';

export const decideHappyFollowUp = (
  followUp: Pick<HappyFollowUp, 'headSha' | 'attempt' | 'mode'>,
  lookup: HappyLookup | null,
): HappyFollowUpAction => {
  const exhausted = followUp.attempt >= HAPPY_FOLLOW_UP_MAX_ATTEMPTS;
  if (lookup === null) {
    return exhausted ? HappyFollowUpAction.GIVE_UP : HappyFollowUpAction.WAIT;
  }
  if (lookup.kind === HappyLookupKind.NOT_FOUND) return HappyFollowUpAction.NOT_FOUND;
  const fullWanted = followUp.mode === HappyReviewMode.FULL;
  const delivered =
    lookup.result?.checkedSha === followUp.headSha &&
    (!fullWanted || lookup.result.review?.mode === HappyScopeMode.FULL);
  if (delivered) return HappyFollowUpAction.DELIVER;
  if (lookup.headSha !== followUp.headSha) return HappyFollowUpAction.HEAD_MOVED;
  if (exhausted) return HappyFollowUpAction.GIVE_UP;
  if (
    !lookup.reviewPending &&
    followUp.attempt >= HAPPY_FOLLOW_UP_MIN_ATTEMPTS_BEFORE_NOT_PUBLISHED
  ) {
    return HappyFollowUpAction.NOT_PUBLISHED;
  }
  return HappyFollowUpAction.WAIT;
};
