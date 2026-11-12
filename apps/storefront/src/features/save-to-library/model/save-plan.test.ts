import fc from 'fast-check';
import { NOT_SAVED, isSaved } from '@/entities/library';
import { applyListChanges, planListChanges, toggledStatus } from './save-plan';

const statuses = fc.record({ isForLater: fc.boolean(), isConsidering: fc.boolean() });

describe('save plan', () => {
  it('reaches the wanted status from any status', () => {
    fc.assert(
      fc.property(statuses, statuses, (from, to) => {
        expect(applyListChanges(from, planListChanges(from, to))).toEqual(to);
      }),
    );
  });

  it('touches only the lists that differ', () => {
    fc.assert(
      fc.property(statuses, (status) => {
        expect(planListChanges(status, status)).toEqual([]);
      }),
    );
  });

  it('undoes a change by planning back to the previous status', () => {
    fc.assert(
      fc.property(statuses, (previous) => {
        const next = toggledStatus(previous);
        const afterUndo = applyListChanges(next, planListChanges(next, previous));
        expect(afterUndo).toEqual(previous);
      }),
    );
  });

  it('toggles between saved for later and nothing saved', () => {
    fc.assert(
      fc.property(statuses, (status) => {
        const next = toggledStatus(status);
        expect(isSaved(next)).toBe(!isSaved(status));
      }),
    );
    expect(toggledStatus(NOT_SAVED)).toEqual({ isForLater: true, isConsidering: false });
  });
});
