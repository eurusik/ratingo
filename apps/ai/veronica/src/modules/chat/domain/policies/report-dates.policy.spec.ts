import * as fc from 'fast-check';

import { civilFromDays, daysFromCivil, requestedReportDates } from './report-dates.policy';

const MS_PER_DAY = 86_400_000;

describe('civil dates', () => {
  it('match Date for any day from 1970 to 2100', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 47_482 }), (days) => {
        const date = new Date(days * MS_PER_DAY);
        const civil = {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate(),
        };
        expect(civilFromDays(days)).toEqual(civil);
        expect(daysFromCivil(civil)).toBe(days);
      }),
    );
  });
});

describe('requestedReportDates', () => {
  const call = (ranges: object[]) =>
    JSON.stringify({ date_ranges: ranges, metrics: ['activeUsers'] });
  const dayMonths = (dates: ReadonlySet<string>) =>
    [...dates].filter((key) => /^\d+\.\d+$/.test(key)).sort();

  it('resolves every day of relative and absolute ranges against Kyiv today', () => {
    const dates = requestedReportDates(
      [
        call([
          { start_date: '7daysAgo', end_date: 'yesterday' },
          { start_date: '2026-10-30', end_date: '2026-11-01' },
        ]),
      ],
      '2026-11-22',
    );
    expect(dayMonths(dates)).toEqual(
      [
        '15.11',
        '16.11',
        '17.11',
        '18.11',
        '19.11',
        '20.11',
        '21.11',
        '30.10',
        '31.10',
        '1.11',
      ].sort(),
    );
    expect(dates.has('21.11.2026')).toBe(true);
    expect(dates.has('22.11')).toBe(false);
  });

  it('crosses month and year boundaries', () => {
    expect(
      dayMonths(
        requestedReportDates([call([{ start_date: '3daysAgo', end_date: 'today' }])], '2026-01-01'),
      ),
    ).toEqual(['29.12', '30.12', '31.12', '1.1'].sort());
  });

  it('keeps only the ends of a reversed or oversized range', () => {
    expect(
      dayMonths(
        requestedReportDates(
          [call([{ start_date: 'yesterday', end_date: '3daysAgo' }])],
          '2026-11-22',
        ),
      ),
    ).toEqual(['19.11', '21.11']);
    expect(
      requestedReportDates(
        [call([{ start_date: '2020-01-01', end_date: 'today' }])],
        '2026-11-22',
      ).has('1.6.2023'),
    ).toBe(false);
  });

  it('ignores text that is not a range and a broken clock line', () => {
    expect(
      requestedReportDates(['{"start":"7daysAgo","note":"2026-11-01"}'], '2026-11-22').size,
    ).toBe(0);
    expect(requestedReportDates([call([{ start_date: 'today' }])], 'never').size).toBe(0);
  });

  it('knows every day inside a requested range and no day outside it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 120 }),
        (endAgo, span, probeAgo) => {
          const startAgo = endAgo + span;
          const today = daysFromCivil({ year: 2026, month: 11, day: 22 });
          const probe = civilFromDays(today - probeAgo);
          const dates = requestedReportDates(
            [call([{ start_date: `${startAgo}daysAgo`, end_date: `${endAgo}daysAgo` }])],
            '2026-11-22',
          );
          const inside = probeAgo >= endAgo && probeAgo <= startAgo;
          expect(dates.has(`${probe.day}.${probe.month}.${probe.year}`)).toBe(inside);
        },
      ),
    );
  });
});
