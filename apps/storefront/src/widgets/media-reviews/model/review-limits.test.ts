import fc from 'fast-check';
import { MAX_REVIEW_TEXT_LENGTH, isNearReviewTextLimit } from './review-limits';

describe('isNearReviewTextLimit', () => {
  it('is true exactly when a tenth of the limit or less is left', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_REVIEW_TEXT_LENGTH }), (length) => {
        const left = MAX_REVIEW_TEXT_LENGTH - length;
        expect(isNearReviewTextLimit(length)).toBe(left * 10 <= MAX_REVIEW_TEXT_LENGTH);
      }),
    );
  });

  it('starts at 252 of 280 characters', () => {
    expect(isNearReviewTextLimit(251)).toBe(false);
    expect(isNearReviewTextLimit(252)).toBe(true);
  });
});
