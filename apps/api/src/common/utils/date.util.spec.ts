import { addUtcDays, formatUtcDayId, formatUtcHourId, startOfUtcDay } from './date.util';

describe('date.util', () => {
  it('formatUtcDayId formats YYYYMMDD', () => {
    expect(formatUtcDayId(new Date('2025-12-21T19:45:10Z'))).toBe('20251221');
  });

  it('formatUtcHourId formats YYYYMMDDHH', () => {
    expect(formatUtcHourId(new Date('2025-12-21T19:45:10Z'))).toBe('2025122119');
    expect(formatUtcHourId(new Date('2025-01-02T04:00:00Z'))).toBe('2025010204');
  });

  describe('startOfUtcDay', () => {
    it('drops the time of day in UTC', () => {
      expect(startOfUtcDay(new Date('2026-11-17T23:59:59.999Z'))).toEqual(
        new Date('2026-11-17T00:00:00.000Z'),
      );
    });
  });

  describe('addUtcDays', () => {
    it('moves a date by whole days', () => {
      expect(addUtcDays(new Date('2026-11-17T00:00:00.000Z'), 120)).toEqual(
        new Date('2027-03-17T00:00:00.000Z'),
      );
    });
  });
});
