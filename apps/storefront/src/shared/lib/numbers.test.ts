import fc from 'fast-check';
import { formatScore, positiveNumber, scoreFromPercent, yearFromDate } from './numbers';

describe('numbers', () => {
  it('maps a 0–100 score onto ten points', () => {
    expect(scoreFromPercent(85)).toBe(8.5);
  });

  it.each([null, undefined, 0, -5, Number.NaN])('treats %s as missing', (value) => {
    expect(scoreFromPercent(value)).toBeUndefined();
    expect(positiveNumber(value)).toBeUndefined();
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

  it('reads the year from any ISO date and ignores empty ones', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1888, max: 2100 }), (year) => {
        expect(yearFromDate(`${year}-05-01`)).toBe(year);
      }),
    );
    expect(yearFromDate(null)).toBeUndefined();
    expect(yearFromDate('0000-00-00')).toBeUndefined();
  });

  it('formats a score with one decimal for the locale', () => {
    expect(formatScore('uk', 8)).toBe('8,0');
    expect(formatScore('en', 7.25)).toBe('7.3');
  });
});
