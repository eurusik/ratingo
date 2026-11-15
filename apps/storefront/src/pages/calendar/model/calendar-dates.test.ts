import fc from 'fast-check';
import {
  addDays,
  isSupportedWeek,
  kyivDateKey,
  weekDays,
  weekStartOf,
  weeksBetween,
} from './calendar-dates';
import { formatWeekMonths, formatWeekSpan, formatWeeksAway } from './calendar-format';
import { isMorningRelease } from './episode-line';

const dateKey = fc
  .date({ min: new Date('2000-01-01'), max: new Date('2100-12-31'), noInvalidDate: true })
  .map((date) => date.toISOString().slice(0, 10));

describe('calendar dates', () => {
  it('reads the date in Kyiv, not UTC', () => {
    expect(kyivDateKey('2026-11-15T22:30:00Z')).toBe('2026-11-16');
    expect(kyivDateKey('2026-07-15T21:30:00Z')).toBe('2026-07-16');
    expect(kyivDateKey('2026-11-15T21:30:00Z')).toBe('2026-11-15');
  });

  it('treats releases before 07:00 Kyiv as morning ones', () => {
    expect(isMorningRelease('2026-11-15T02:00:00Z')).toBe(true);
    expect(isMorningRelease('2026-11-15T05:00:00Z')).toBe(false);
    expect(isMorningRelease('2026-11-15T19:00:00Z')).toBe(false);
  });

  it('starts every week on Monday', () => {
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    fc.assert(
      fc.property(dateKey, (key) => {
        const start = weekStartOf(key);
        expect(new Date(`${start}T00:00:00Z`).getUTCDay()).toBe(1);
        expect(start <= key && key <= addDays(start, 6)).toBe(true);
      }),
    );
  });

  it('lists seven consecutive days', () => {
    fc.assert(
      fc.property(dateKey, (key) => {
        const days = weekDays(weekStartOf(key));
        expect(days).toHaveLength(7);
        days.forEach((day, index) => expect(day).toBe(addDays(days[0], index)));
      }),
    );
  });

  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('formats a short week span without the year', () => {
    expect(formatWeekSpan('uk', '2026-11-09')).toBe('9–15 листопада');
    expect(formatWeekSpan('uk', '2026-11-30')).toBe('30 листопада – 6 грудня');
    expect(formatWeekSpan('uk', '2026-12-28')).toBe('28 грудня – 3 січня');
    expect(formatWeekSpan('en', '2026-12-28')).toBe('December 28 – January 3');
    expect(formatWeekSpan('en', '2026-11-09')).toMatch(/^November 9\s–\s15$/);
    expect(formatWeekMonths('uk', '2026-11-09')).toBe('лист.');
    expect(formatWeekMonths('uk', '2026-11-30')).toBe('лист.–груд.');
  });

  it('counts whole weeks between week starts', () => {
    expect(weeksBetween('2026-11-09', '2026-11-09')).toBe(0);
    expect(weeksBetween('2026-11-09', '2026-11-30')).toBe(3);
    expect(weeksBetween('2026-11-09', '2026-10-26')).toBe(-2);
    expect(weeksBetween('2026-03-23', '2026-03-30')).toBe(1);
  });

  it('names distant weeks relative to today', () => {
    expect(formatWeeksAway('uk', 3)).toBe('Через 3 тижні');
    expect(formatWeeksAway('uk', -2)).toBe('2 тижні тому');
  });

  it('supports only weeks that stay inside the years the API accepts', () => {
    expect(isSupportedWeek('2026-11-09')).toBe(true);
    expect(isSupportedWeek('1999-12-27')).toBe(false);
    expect(isSupportedWeek('2100-12-27')).toBe(false);
  });
});
