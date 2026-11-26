import * as fc from 'fast-check';

import { JOB_FAILURE_CLASSES } from '../constants/job-failure-class.constants';
import { type JobFailureTally } from '../entities/job-failure-tally.entity';
import { type JobFailure } from '../entities/job-failure.entity';

import { tallyKeyOf, tallyWith } from './job-failure-tally.policy';

const failureArb: fc.Arbitrary<JobFailure> = fc.record({
  day: fc.constantFrom('2026-11-25', '2026-11-26'),
  queue: fc.constantFrom('ingestion', 'stats-queue'),
  jobType: fc.constantFrom('sync-show', 'sync-movie'),
  schedulerJobId: fc.constantFrom(null, 'scheduled-trending'),
  errorClass: fc.constantFrom(...JOB_FAILURE_CLASSES),
  attemptsExhausted: fc.boolean(),
  failedAtMs: fc.integer({ min: 0, max: 1_000_000 }),
  message: fc.string({ maxLength: 20 }),
});

const sameKeyFailuresArb = fc
  .tuple(
    failureArb,
    fc.array(
      fc.tuple(fc.boolean(), fc.integer({ min: 0, max: 1_000_000 }), fc.string({ maxLength: 20 })),
      { maxLength: 30 },
    ),
  )
  .map(([first, rest]) => [
    first,
    ...rest.map(([attemptsExhausted, failedAtMs, message]) => ({
      ...first,
      attemptsExhausted,
      failedAtMs,
      message,
    })),
  ]);

const talliedAll = (failures: readonly JobFailure[]): JobFailureTally =>
  failures.reduce<JobFailureTally | undefined>(tallyWith, undefined) as JobFailureTally;

describe('job failure tally', () => {
  it('counts every failure and every exhausted attempt once', () => {
    fc.assert(
      fc.property(sameKeyFailuresArb, (failures) => {
        const tally = talliedAll(failures);
        expect(tally.failureCount).toBe(failures.length);
        expect(tally.exhaustedCount).toBe(failures.filter((f) => f.attemptsExhausted).length);
      }),
    );
  });

  it('keeps the earliest and latest failure time and a message from the latest one', () => {
    fc.assert(
      fc.property(sameKeyFailuresArb, (failures) => {
        const tally = talliedAll(failures);
        const times = failures.map((f) => f.failedAtMs);
        expect(tally.firstFailedAtMs).toBe(Math.min(...times));
        expect(tally.lastFailedAtMs).toBe(Math.max(...times));
        const latestMessages = failures
          .filter((f) => f.failedAtMs === tally.lastFailedAtMs)
          .map((f) => f.message);
        expect(latestMessages).toContain(tally.lastMessage);
      }),
    );
  });

  it('gives the same counts in any order', () => {
    fc.assert(
      fc.property(
        sameKeyFailuresArb.chain((failures) =>
          fc.shuffledSubarray(failures, { minLength: failures.length }),
        ),
        (shuffled) => {
          const tally = talliedAll(shuffled);
          expect(tally.failureCount).toBe(shuffled.length);
        },
      ),
    );
  });

  it('separates failures that differ in day, queue, job type, scheduler or class', () => {
    fc.assert(
      fc.property(failureArb, failureArb, (left, right) => {
        const sameRow =
          left.day === right.day &&
          left.queue === right.queue &&
          left.jobType === right.jobType &&
          left.schedulerJobId === right.schedulerJobId &&
          left.errorClass === right.errorClass;
        expect(tallyKeyOf(left) === tallyKeyOf(right)).toBe(sameRow);
      }),
    );
  });
});
