import { JobFailureClass } from '@/modules/job-failures/domain/constants/job-failure-class.constants';
import { type JobFailure } from '@/modules/job-failures/domain/entities/job-failure.entity';

import { JobFailureBatch } from './job-failure-batch';

const failure = (jobType: string): JobFailure => ({
  day: '2026-11-26',
  queue: 'ingestion',
  jobType,
  schedulerJobId: null,
  errorClass: JobFailureClass.TIMEOUT,
  attemptsExhausted: false,
  failedAtMs: 1,
  message: 'Request timeout',
});

describe('JobFailureBatch', () => {
  it('merges failures on one row and drops new rows past the limit', () => {
    const batch = new JobFailureBatch(2);
    ['a', 'a', 'b', 'c', 'd', 'b'].forEach((jobType) => batch.add(failure(jobType)));

    const drained = batch.drain();

    expect(drained.tallies.map((tally) => [tally.jobType, tally.failureCount])).toEqual([
      ['a', 2],
      ['b', 2],
    ]);
    expect(drained.droppedFailures).toBe(2);
  });

  it('starts empty after a drain', () => {
    const batch = new JobFailureBatch(2);
    batch.add(failure('a'));
    batch.drain();

    expect(batch.drain()).toEqual({ tallies: [], droppedFailures: 0 });
  });
});
