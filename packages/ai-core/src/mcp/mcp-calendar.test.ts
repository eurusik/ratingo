import { daysAgoOf, epochDayOf } from './mcp-calendar';

const TODAY = epochDayOf(Date.UTC(2026, 10, 24));

describe('daysAgoOf', () => {
  it.each([
    ['today', 0],
    ['yesterday', 1],
    ['30daysAgo', 30],
    ['2026-11-24', 0],
    ['2026-11-01', 23],
    ['2025-11-24', 365],
    ['2024-02-29', 999],
    ['2026-11-25', -1],
  ])('reads %s as %d days ago', (value, expected) => {
    expect(daysAgoOf(value, TODAY)).toBe(expected);
  });

  it('matches Date for every day of several years', () => {
    for (let day = 0; day < 3 * 366; day += 1) {
      const date = new Date(Date.UTC(2024, 0, 1) + day * 86_400_000);
      const iso = date.toISOString().slice(0, 10);
      expect(daysAgoOf(iso, TODAY)).toBe(TODAY - epochDayOf(date.getTime()));
    }
  });

  it.each([['2026-02-30'], ['2026-13-01'], ['last week'], [42], ['1e3daysAgo']])(
    'rejects %p',
    (value) => {
      expect(daysAgoOf(value, TODAY)).toBeUndefined();
    },
  );
});
