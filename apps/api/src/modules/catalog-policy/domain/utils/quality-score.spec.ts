import * as fc from 'fast-check';

import { meetsMinQualityScore } from './quality-score';

describe('meetsMinQualityScore', () => {
  it.each([null, undefined, NaN, Infinity, -Infinity])('rejects a %p score', (score) => {
    expect(meetsMinQualityScore(score, 0)).toBe(false);
  });

  it('accepts a score equal to the minimum', () => {
    expect(meetsMinQualityScore(0.5, 0.5)).toBe(true);
  });

  it('rejects any score when the minimum is NaN', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (score) => {
        expect(meetsMinQualityScore(score, NaN)).toBe(false);
      }),
    );
  });

  it('passes exactly when a finite score is at or above the minimum', () => {
    fc.assert(
      fc.property(
        fc.option(fc.oneof(fc.double({ min: 0, max: 1 }), fc.constant(NaN))),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (score, min) => {
          const expected = typeof score === 'number' && !Number.isNaN(score) && score >= min;
          expect(meetsMinQualityScore(score, min)).toBe(expected);
        },
      ),
    );
  });
});
