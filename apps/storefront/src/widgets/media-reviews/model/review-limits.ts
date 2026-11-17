export const MAX_REVIEW_TEXT_LENGTH = 280;

const LENGTH_COUNTER_VISIBLE_FROM = Math.ceil(MAX_REVIEW_TEXT_LENGTH * 0.9);

export function isNearReviewTextLimit(length: number): boolean {
  return length >= LENGTH_COUNTER_VISIBLE_FROM;
}

export function isAtReviewTextLimit(length: number): boolean {
  return length >= MAX_REVIEW_TEXT_LENGTH;
}
