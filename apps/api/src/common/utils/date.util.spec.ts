import fc from 'fast-check';

import {
  addUtcDays,
  formatUtcDayId,
  formatUtcHourId,
  middayUtcOfCalendarDate,
  startOfUtcDay,
} from './date.util';

const calendarDate = fc
  .date({
    min: new Date('1950-01-01T00:00:00Z'),
    max: new Date('2100-12-31T00:00:00Z'),
    noInvalidDate: true,
  })
  .map((date) => date.toISOString().slice(0, 10));

const dateIn = (timeZone: string, instant: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(instant);

const fixedUtcOffsetZone = (hoursEastOfUtc: number): string => {
  if (hoursEastOfUtc === 0) return 'Etc/GMT';
  const posixSign = hoursEastOfUtc > 0 ? '-' : '+';
  return `Etc/GMT${posixSign}${Math.abs(hoursEastOfUtc)}`;
};

const zoneWithinElevenHoursOfUtc = fc.oneof(
  fc.constantFrom(
    'Europe/Kyiv',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Pacific/Pago_Pago',
  ),
  fc.integer({ min: -11, max: 11 }).map(fixedUtcOffsetZone),
);

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

  describe('middayUtcOfCalendarDate', () => {
    it('puts a calendar date at 12:00 UTC', () => {
      expect(middayUtcOfCalendarDate('2026-11-19')).toEqual(new Date('2026-11-19T12:00:00.000Z'));
    });

    it('stays on the same calendar day in Kyiv and in every zone from UTC-11 to UTC+11', () => {
      fc.assert(
        fc.property(calendarDate, zoneWithinElevenHoursOfUtc, (date, timeZone) => {
          expect(dateIn(timeZone, middayUtcOfCalendarDate(date))).toBe(date);
        }),
        {
          examples: [
            ['1977-12-04', fixedUtcOffsetZone(11)],
            ['1977-12-04', fixedUtcOffsetZone(-11)],
          ],
        },
      );
    });

    it('moves to the next day only where the clock runs at UTC+12, as Noumea did on 1977-12-04', () => {
      expect(dateIn('Pacific/Noumea', middayUtcOfCalendarDate('1977-12-04'))).toBe('1977-12-05');
      expect(dateIn('Pacific/Noumea', middayUtcOfCalendarDate('1977-12-03'))).toBe('1977-12-03');
    });

    it('keeps a value that already carries a time', () => {
      expect(middayUtcOfCalendarDate('2026-11-19T01:00:00Z')).toEqual(
        new Date('2026-11-19T01:00:00Z'),
      );
    });
  });
});
