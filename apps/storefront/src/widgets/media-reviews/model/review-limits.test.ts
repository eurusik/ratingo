import {
  MAX_REVIEW_TEXT_LENGTH,
  isAtReviewTextLimit,
  isNearReviewTextLimit,
} from './review-limits';

describe('review text limits', () => {
  it('counts as near the limit from 252 of 280 characters', () => {
    expect(isNearReviewTextLimit(251)).toBe(false);
    expect(isNearReviewTextLimit(252)).toBe(true);
  });

  it('reaches the limit only at the maximum length', () => {
    expect(isAtReviewTextLimit(MAX_REVIEW_TEXT_LENGTH - 1)).toBe(false);
    expect(isAtReviewTextLimit(MAX_REVIEW_TEXT_LENGTH)).toBe(true);
  });
});
