import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, getCalendarDays, createCalendarConfig } from './dates';

describe('calendar/dates', () => {
  describe('formatDate', () => {
    it('should format a date object into YYYY-MM-DD format', () => {
      const date = new Date(2023, 10, 5); // 5th November 2023
      expect(formatDate(date)).toBe('2023-11-05');
    });

    it('should pad month and day with a zero', () => {
      const date = new Date(2023, 0, 1); // 1st January 2023
      expect(formatDate(date)).toBe('2023-01-01');
    });
  });

  describe('getCalendarDays', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset process.env before each test
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original process.env
      process.env = originalEnv;
    });

    it('should return the default value of 30 if env is not set', () => {
      delete process.env.AIRINGS_CALENDAR_DAYS;
      expect(getCalendarDays()).toBe(30);
    });

    it('should return the value from the environment variable if it is valid', () => {
      process.env.AIRINGS_CALENDAR_DAYS = '15';
      expect(getCalendarDays()).toBe(15);
    });

    it('should return 1 if the env value is less than 1', () => {
      process.env.AIRINGS_CALENDAR_DAYS = '0';
      expect(getCalendarDays()).toBe(1);
    });

    it('should return 30 if the env value is greater than 30', () => {
      process.env.AIRINGS_CALENDAR_DAYS = '45';
      expect(getCalendarDays()).toBe(30);
    });

    it('should return the default value if the env value is not a number', () => {
      process.env.AIRINGS_CALENDAR_DAYS = 'abc';
      expect(getCalendarDays()).toBe(30);
    });
  });

  describe('createCalendarConfig', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create a config with the current date and default days', () => {
      const fakeDate = new Date(2023, 4, 15);
      vi.setSystemTime(fakeDate);

      const config = createCalendarConfig();

      expect(config).toEqual({
        startDate: '2023-05-15',
        days: 30, // Default value
      });
    });

    it('should respect the environment variable for days', () => {
      process.env.AIRINGS_CALENDAR_DAYS = '10';
      const fakeDate = new Date(2023, 4, 15);
      vi.setSystemTime(fakeDate);

      const config = createCalendarConfig();

      expect(config).toEqual({
        startDate: '2023-05-15',
        days: 10,
      });

      delete process.env.AIRINGS_CALENDAR_DAYS;
    });
  });
});
