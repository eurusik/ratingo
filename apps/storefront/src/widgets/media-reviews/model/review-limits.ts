export const MAX_REVIEW_TEXT_LENGTH = 280;

const COUNTER_THRESHOLD_SHARE = 0.1;

export function isNearReviewTextLimit(length: number): boolean {
  return MAX_REVIEW_TEXT_LENGTH - length <= MAX_REVIEW_TEXT_LENGTH * COUNTER_THRESHOLD_SHARE;
}
