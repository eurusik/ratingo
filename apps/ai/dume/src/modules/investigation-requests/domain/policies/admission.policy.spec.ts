import fc from 'fast-check';

import { RejectionReason } from '../constants/request.constants';

import { decideAdmission, type AdmissionReading } from './admission.policy';

const open: AdmissionReading = {
  spentTodayUsd: 0.2,
  dayBudgetUsd: 1.5,
  acceptedToday: 3,
  maxPerDay: 10,
  waiting: 0,
  maxWaiting: 2,
};

describe('decideAdmission', () => {
  it('accepts a request when every limit has room', () => {
    expect(decideAdmission(open)).toBeNull();
  });

  it.each([
    ['the day budget is spent', { spentTodayUsd: 1.5 }, RejectionReason.DAY_BUDGET],
    ['the daily count is reached', { acceptedToday: 10 }, RejectionReason.DAILY_COUNT_CAP],
    ['the queue is full', { waiting: 2 }, RejectionReason.QUEUE_FULL],
  ])('rejects when %s', (_name, change, reason) => {
    expect(decideAdmission({ ...open, ...change })).toBe(reason);
  });

  it('names the money limit first when several limits are hit', () => {
    expect(
      decideAdmission({ ...open, spentTodayUsd: 2, acceptedToday: 10, waiting: 5 }),
    ).toBe(RejectionReason.DAY_BUDGET);
  });

  it('accepts exactly when no limit is reached', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 5 }),
        (spentTodayUsd, acceptedToday, waiting) => {
          const decision = decideAdmission({ ...open, spentTodayUsd, acceptedToday, waiting });
          const roomLeft = spentTodayUsd < 1.5 && acceptedToday < 10 && waiting < 2;
          return (decision === null) === roomLeft;
        },
      ),
    );
  });
});
