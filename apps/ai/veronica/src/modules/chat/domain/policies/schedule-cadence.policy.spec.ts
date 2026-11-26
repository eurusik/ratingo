import * as fc from 'fast-check';

import { spellNumber } from './number-words.policy';
import { CUSTOM_CADENCE, describeCadence, scheduleFromLabel } from './schedule-cadence.policy';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const cron = (pattern: string): string => describeCadence({ cron: pattern });

const minute = fc.integer({ min: 0, max: 59 });
const hourSet = fc.uniqueArray(fc.integer({ min: 0, max: 23 }), { minLength: 1, maxLength: 24 });
const weekday = fc.integer({ min: 0, max: 6 });

describe('describeCadence', () => {
  it.each([
    ['0 8,20 * * *', 'twice a day'],
    ['30 3 * * *', 'daily'],
    ['0 */4 * * *', 'every four hours'],
    ['0 7 * * 1', 'weekly on Monday'],
    ['0 7 * * 0,2-6', 'daily except Monday'],
    ['*/20 * * * *', 'every twenty minutes'],
    ['0 1,5,9,13,17,21 * * *', 'six times a day'],
    ['0 9 * * 1,3,5', 'on Monday, Wednesday and Friday'],
    ['0 9,21 * * 6', 'twice a day on Saturday'],
    ['0 9 1 * *', CUSTOM_CADENCE],
    ['not a cron', CUSTOM_CADENCE],
  ])('describes %s as %s', (pattern, words) => {
    expect(cron(pattern)).toBe(words);
  });

  it.each([
    [120_000, 'every two minutes'],
    [3_600_000, 'every hour'],
    [21_600_000, 'every six hours'],
    [9_000_000, 'every 150 minutes'],
    [1500, CUSTOM_CADENCE],
  ])('describes an interval of %d ms as %s', (everyMs, words) => {
    expect(describeCadence({ everyMs })).toBe(words);
  });

  it('calls a once-a-day job on one weekday weekly on that day', () => {
    fc.assert(
      fc.property(minute, fc.integer({ min: 0, max: 23 }), weekday, (m, h, day) => {
        expect(cron(`${m} ${h} * * ${day}`)).toBe(`weekly on ${WEEKDAYS[day]}`);
      }),
    );
  });

  it('counts the runs of a daily job by its distinct hours', () => {
    fc.assert(
      fc.property(minute, hourSet, (m, hours) => {
        const words = cron(`${m} ${hours.join(',')} * * *`);
        const expected =
          hours.length === 1
            ? 'daily'
            : hours.length === 2
              ? 'twice a day'
              : `${spellNumber(hours.length)} times a day`;
        expect(words).toBe(expected);
      }),
    );
  });

  it('reads an hour step as every N hours whatever the minute', () => {
    fc.assert(
      fc.property(minute, fc.integer({ min: 2, max: 23 }), (m, step) => {
        expect(cron(`${m} */${step} * * *`)).toBe(`every ${spellNumber(step)} hours`);
      }),
    );
  });

  it('treats 7 and 0 as the same Sunday', () => {
    fc.assert(
      fc.property(minute, fc.integer({ min: 0, max: 23 }), (m, h) => {
        expect(cron(`${m} ${h} * * 7`)).toBe(cron(`${m} ${h} * * 0`));
      }),
    );
  });

  it('says the same thing for the same weekdays however they are listed', () => {
    fc.assert(
      fc.property(fc.uniqueArray(weekday, { minLength: 1, maxLength: 7 }), (days) => {
        const sorted = [...days].sort((a, b) => a - b).join(',');
        expect(cron(`0 7 * * ${days.join(',')}`)).toBe(cron(`0 7 * * ${sorted}`));
      }),
    );
  });

  it('never leaks cron syntax or a digit into the words', () => {
    fc.assert(
      fc.property(fc.string(), (pattern) => {
        expect(cron(pattern)).not.toMatch(/[*/\d]/);
      }),
    );
    fc.assert(
      fc.property(minute, hourSet, fc.uniqueArray(weekday, { minLength: 1 }), (m, hours, days) => {
        expect(cron(`${m} ${hours.join(',')} * * ${days.join(',')}`)).not.toMatch(/[*/:\d]/);
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (minutes) => {
        expect(describeCadence({ everyMs: minutes * 60_000 })).not.toMatch(/\d/);
      }),
    );
  });
});

describe('scheduleFromLabel', () => {
  it('turns the metric label of an interval job into an interval', () => {
    expect(scheduleFromLabel('every 120s')).toEqual({ everyMs: 120_000 });
  });

  it('keeps any other label as a cron pattern', () => {
    fc.assert(
      fc.property(fc.string(), (label) => {
        fc.pre(!/^every \d+s$/.test(label));
        expect(scheduleFromLabel(label)).toEqual({ cron: label });
      }),
    );
  });
});
