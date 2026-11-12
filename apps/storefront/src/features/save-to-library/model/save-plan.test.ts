import fc from 'fast-check';
import { isSaved } from '@/entities/library';
import type { MediaSaveStatus } from '@/shared/api';
import { ensureSaved, planListChanges } from './save-plan';

const statuses = fc.record({ isForLater: fc.boolean(), isConsidering: fc.boolean() });

function applyPlan(from: MediaSaveStatus, to: MediaSaveStatus): MediaSaveStatus {
  return planListChanges(from, to).reduce<MediaSaveStatus>(
    (status, { list, action }) => ({
      ...status,
      [list === 'for_later' ? 'isForLater' : 'isConsidering']: action === 'save',
    }),
    from,
  );
}

describe('save plan', () => {
  it('reaches the wanted status from any status', () => {
    fc.assert(
      fc.property(statuses, statuses, (from, to) => expect(applyPlan(from, to)).toEqual(to)),
    );
  });

  it('touches only the lists that differ', () => {
    fc.assert(
      fc.property(statuses, (status) => expect(planListChanges(status, status)).toEqual([])),
    );
  });

  it('saving keeps every list a title is already in', () => {
    fc.assert(
      fc.property(statuses, (status) => {
        const saved = ensureSaved(status);
        expect(isSaved(saved)).toBe(true);
        if (isSaved(status)) expect(saved).toEqual(status);
        expect(planListChanges(status, saved).every(({ action }) => action === 'save')).toBe(true);
      }),
    );
  });
});
