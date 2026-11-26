import * as fc from 'fast-check';

import { JOB_FAILURE_RETENTION_DAYS, MS_PER_DAY } from '../constants/job-failure.constants';

import { isRetentionDue, retentionCutoffMs } from './retention.policy';

const instantArb = fc.integer({ min: 0, max: 4_000_000_000_000 });

describe('retention policy', () => {
  it('is due on the first failure after start', () => {
    fc.assert(fc.property(instantArb, (nowMs) => expect(isRetentionDue(null, nowMs)).toBe(true)));
  });

  it('is due again only a whole day after the last prune', () => {
    fc.assert(
      fc.property(instantArb, fc.integer({ min: 0, max: 3 * MS_PER_DAY }), (lastMs, elapsed) => {
        expect(isRetentionDue(lastMs, lastMs + elapsed)).toBe(elapsed >= MS_PER_DAY);
      }),
    );
  });

  it('keeps exactly the retention period', () => {
    fc.assert(
      fc.property(instantArb, (nowMs) => {
        expect(nowMs - retentionCutoffMs(nowMs)).toBe(JOB_FAILURE_RETENTION_DAYS * MS_PER_DAY);
      }),
    );
  });
});
