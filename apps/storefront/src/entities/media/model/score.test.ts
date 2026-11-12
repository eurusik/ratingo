import fc from 'fast-check';
import { ratingVerdict, scoreFromPercent, type RatingVerdict } from './score';

const ORDER: Record<RatingVerdict, number> = { bad: 0, mixed: 1, good: 2 };

describe('ratingVerdict', () => {
  it.each([
    [8.5, 'good'],
    [7, 'good'],
    [6.9, 'mixed'],
    [5.5, 'mixed'],
    [5.4, 'bad'],
  ])('rates %s as %s', (score, verdict) => {
    expect(ratingVerdict(score)).toBe(verdict);
  });

  it('never rates a higher score worse', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (a, b) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          expect(ORDER[ratingVerdict(high)]).toBeGreaterThanOrEqual(ORDER[ratingVerdict(low)]);
        },
      ),
    );
  });
});

describe('scoreFromPercent', () => {
  it('maps a 0–100 score onto ten points', () => {
    expect(scoreFromPercent(85)).toBe(8.5);
  });

  it.each([null, undefined, 0, -5, Number.NaN])('treats %s as no score', (percent) => {
    expect(scoreFromPercent(percent)).toBeUndefined();
  });

  it('keeps every positive percent within ten points', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 100, noNaN: true }), (percent) => {
        const score = scoreFromPercent(percent);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(10);
      }),
    );
  });
});
