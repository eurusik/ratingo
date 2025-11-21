import { describe, it, expect } from 'vitest';
import { getMonthStartDate, getMonthlyStartDates } from './dates';

describe('monthly/dates', () => {
  describe('getMonthStartDate', () => {
    it('returns first day of the same month', () => {
      const date = new Date(2025, 2, 15);
      const result = getMonthStartDate(date, 0);
      expect(result).toBe('2025-03-01');
    });

    it('handles previous and next months', () => {
      const date = new Date(2025, 2, 15);
      const prev = getMonthStartDate(date, -1);
      const next = getMonthStartDate(date, 1);
      expect(prev).toBe('2025-02-01');
      expect(next).toBe('2025-04-01');
    });

    it('handles year boundaries correctly', () => {
      const date = new Date(2025, 0, 10);
      const prev = getMonthStartDate(date, -1);
      const next = getMonthStartDate(date, 1);
      expect(getMonthStartDate(date, 0)).toBe('2025-01-01');
      expect(prev).toBe('2024-12-01');
      expect(next).toBe('2025-02-01');
    });
  });

  describe('getMonthlyStartDates', () => {
    it('returns six months starting from current month', () => {
      const now = new Date(2025, 2, 15);
      const result = getMonthlyStartDates(now);
      expect(result).toEqual([
        '2025-03-01',
        '2025-02-01',
        '2025-01-01',
        '2024-12-01',
        '2024-11-01',
        '2024-10-01',
      ]);
    });

    it('works from January across previous months', () => {
      const now = new Date(2025, 0, 10);
      const result = getMonthlyStartDates(now);
      expect(result).toEqual([
        '2025-01-01',
        '2024-12-01',
        '2024-11-01',
        '2024-10-01',
        '2024-09-01',
        '2024-08-01',
      ]);
    });
  });
});
