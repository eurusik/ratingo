import fc from 'fast-check';

import { utcDayIndex, utcDayKey, utcDayStartMs } from './utc-day';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('UTC day helpers', () => {
  it('start the day at midnight UTC and key it by its index', () => {
    const noon = Date.UTC(2026, 10, 27, 12, 0, 0);

    expect(utcDayStartMs(noon)).toBe(Date.UTC(2026, 10, 27));
    expect(utcDayKey(noon)).toBe(`day${utcDayIndex(noon)}`);
  });

  it('give the same key to every instant of a day and a new one at midnight', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40_000 }),
        fc.integer({ min: 0, max: MS_PER_DAY - 1 }),
        (day, offset) => {
          const start = day * MS_PER_DAY;
          return (
            utcDayKey(start + offset) === utcDayKey(start) &&
            utcDayKey(start + MS_PER_DAY) !== utcDayKey(start) &&
            utcDayStartMs(start + offset) === start
          );
        },
      ),
    );
  });
});
