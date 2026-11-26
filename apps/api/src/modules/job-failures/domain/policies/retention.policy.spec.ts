import * as fc from 'fast-check';

import { MS_PER_DAY } from '../constants/job-failure.constants';

import { isRetentionDue } from './retention.policy';

const instantArb = fc.integer({ min: 0, max: 4_000_000_000_000 });

describe('retention policy', () => {
  it('is due on the first flush after start', () => {
    fc.assert(fc.property(instantArb, (nowMs) => expect(isRetentionDue(null, nowMs)).toBe(true)));
  });

  it('is due again only a whole day after the last prune', () => {
    fc.assert(
      fc.property(instantArb, fc.integer({ min: 0, max: 3 * MS_PER_DAY }), (lastMs, elapsed) => {
        expect(isRetentionDue(lastMs, lastMs + elapsed)).toBe(elapsed >= MS_PER_DAY);
      }),
    );
  });
});
