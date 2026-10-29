import * as fc from 'fast-check';

import { LINK_PENDING_IMPORTS_MIN_AGE_MS } from '../constants/import-pending.constants';

import { pendingLinkSweepCutoffMs } from './pending-link-sweep.policy';

const MAX_EPOCH_MS = 4_102_444_800_000;
const MAX_AGE_MS = 30 * 24 * 60 * 60_000;

const nowMsArb = fc.integer({ min: MAX_AGE_MS, max: MAX_EPOCH_MS });
const minAgeArb = fc.integer({ min: 1, max: MAX_AGE_MS });

describe('pendingLinkSweepCutoffMs - property tests', () => {
  it('lies exactly minAgeMs before now', () => {
    fc.assert(
      fc.property(nowMsArb, minAgeArb, (nowMs, minAgeMs) => {
        expect(nowMs - pendingLinkSweepCutoffMs(nowMs, minAgeMs)).toBe(minAgeMs);
      }),
    );
  });

  it('selects an item only once it has been untouched for longer than minAgeMs', () => {
    fc.assert(
      fc.property(nowMsArb, minAgeArb, fc.nat({ max: MAX_AGE_MS }), (nowMs, minAgeMs, ageMs) => {
        const updatedAtMs = nowMs - ageMs;
        const selected = updatedAtMs < pendingLinkSweepCutoffMs(nowMs, minAgeMs);
        expect(selected).toBe(ageMs > minAgeMs);
      }),
    );
  });

  it('moves forward monotonically with the clock', () => {
    fc.assert(
      fc.property(nowMsArb, nowMsArb, (a, b) => {
        const [earlier, later] = a <= b ? [a, b] : [b, a];
        expect(pendingLinkSweepCutoffMs(earlier)).toBeLessThanOrEqual(
          pendingLinkSweepCutoffMs(later),
        );
      }),
    );
  });

  it('defaults to the configured minimum age', () => {
    fc.assert(
      fc.property(nowMsArb, (nowMs) => {
        expect(pendingLinkSweepCutoffMs(nowMs)).toBe(nowMs - LINK_PENDING_IMPORTS_MIN_AGE_MS);
      }),
    );
  });
});
