import { daysFromToday } from './episode-days';

describe('daysFromToday', () => {
  const now = new Date(2026, 10, 15, 22, 30).getTime();

  it('reads a date-only air date in local time', () => {
    expect(daysFromToday('2026-11-15', now)).toBe(0);
    expect(daysFromToday('2026-11-14', now)).toBe(-1);
  });

  it('compares calendar days, not hours', () => {
    expect(daysFromToday(new Date(2026, 10, 16, 0, 15).toISOString(), now)).toBe(1);
  });
});
