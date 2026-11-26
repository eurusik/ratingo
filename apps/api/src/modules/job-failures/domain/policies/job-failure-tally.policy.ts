import { type JobFailureTally } from '../entities/job-failure-tally.entity';
import { type JobFailure } from '../entities/job-failure.entity';

export const tallyKeyOf = (failure: JobFailure): string =>
  JSON.stringify([
    failure.day,
    failure.queue,
    failure.jobType,
    failure.schedulerJobId,
    failure.errorClass,
  ]);

const firstTally = (failure: JobFailure): JobFailureTally => ({
  day: failure.day,
  queue: failure.queue,
  jobType: failure.jobType,
  schedulerJobId: failure.schedulerJobId,
  errorClass: failure.errorClass,
  failureCount: 1,
  exhaustedCount: failure.attemptsExhausted ? 1 : 0,
  firstFailedAtMs: failure.failedAtMs,
  lastFailedAtMs: failure.failedAtMs,
  lastMessage: failure.message,
});

const addedTo = (tally: JobFailureTally, failure: JobFailure): JobFailureTally => {
  const isNewest = failure.failedAtMs >= tally.lastFailedAtMs;
  return {
    ...tally,
    failureCount: tally.failureCount + 1,
    exhaustedCount: tally.exhaustedCount + (failure.attemptsExhausted ? 1 : 0),
    firstFailedAtMs: Math.min(tally.firstFailedAtMs, failure.failedAtMs),
    lastFailedAtMs: isNewest ? failure.failedAtMs : tally.lastFailedAtMs,
    lastMessage: isNewest ? failure.message : tally.lastMessage,
  };
};

export const tallyWith = (
  tally: JobFailureTally | undefined,
  failure: JobFailure,
): JobFailureTally => (tally === undefined ? firstTally(failure) : addedTo(tally, failure));

export const failuresIn = (tallies: readonly JobFailureTally[]): number =>
  tallies.reduce((sum, tally) => sum + tally.failureCount, 0);
