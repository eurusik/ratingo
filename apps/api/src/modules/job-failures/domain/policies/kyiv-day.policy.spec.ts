import * as fc from 'fast-check';

import { MS_PER_DAY } from '../constants/job-failure.constants';

import { kyivDayOf } from './kyiv-day.policy';

const instantArb = fc.integer({ min: 1_577_836_800_000, max: 2_051_222_400_000 });

describe('kyivDayOf', () => {
  it.each([
    [1_795_643_940_000, '2026-11-25'],
    [1_795_644_000_000, '2026-11-26'],
    [1_784_149_140_000, '2026-07-15'],
    [1_784_149_200_000, '2026-07-16'],
  ])('puts %d on the Kyiv day %s', (epochMs, day) => {
    expect(kyivDayOf(epochMs)).toBe(day);
  });

  it('always returns an ISO date that never goes backwards in time', () => {
    fc.assert(
      fc.property(instantArb, fc.integer({ min: 0, max: 3 * MS_PER_DAY }), (epochMs, later) => {
        const day = kyivDayOf(epochMs);
        expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(kyivDayOf(epochMs + later) >= day).toBe(true);
      }),
    );
  });
});
