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

  it('resolves relative and absolute range ends against Kyiv today', () => {
    const dates = requestedReportDates(
      [
        call([
          { start_date: '7daysAgo', end_date: 'yesterday' },
          { start_date: '2026-10-30', end_date: 'today' },
        ]),
      ],
      '2026-11-22',
    );
    expect([...dates].sort()).toEqual(
      [
        '15.11',
        '15.11.2026',
        '21.11',
        '21.11.2026',
        '30.10',
        '30.10.2026',
        '22.11',
        '22.11.2026',
      ].sort(),
    );
  });

  it('crosses month and year boundaries', () => {
    expect(
      requestedReportDates([call([{ start_date: '3daysAgo', end_date: 'today' }])], '2026-01-01'),
    ).toEqual(new Set(['29.12', '29.12.2025', '1.1', '1.1.2026']));
  });

  it('ignores text that is not a range end and a broken clock line', () => {
    expect(
      requestedReportDates(['{"start":"7daysAgo","note":"2026-11-01"}'], '2026-11-22').size,
    ).toBe(0);
    expect(requestedReportDates([call([{ start_date: 'today' }])], 'never').size).toBe(0);
  });
});
