import { formatKyivDateTime } from './kyiv-time';

describe('formatKyivDateTime', () => {
  it('uses winter time in November', () => {
    expect(formatKyivDateTime(Date.UTC(2026, 10, 22, 12, 5))).toBe('2026-11-22 14:05');
  });

  it('uses summer time in July and rolls the date over midnight', () => {
    expect(formatKyivDateTime(Date.UTC(2026, 6, 1, 21, 30))).toBe('2026-07-02 00:30');
  });
});
