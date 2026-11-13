import fc from 'fast-check';
import { ratingVerdict, type RatingVerdict } from './score';

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
