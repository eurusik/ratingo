import { Logger } from '@nestjs/common';

import { TraktApiException } from '@/common/exceptions/external-api.exception';
import { DatabaseException } from '@/common/exceptions/database.exception';

import { JobFailureClass } from '@/modules/job-failures/domain/constants/job-failure-class.constants';
import {
  JOB_FAILURE_RETENTION_DAYS,
  MS_PER_DAY,
} from '@/modules/job-failures/domain/constants/job-failure.constants';
import { type JobFailureSummaryRepository } from '@/modules/job-failures/domain/repositories/job-failure-summary.repository';

import { JobFailureRecorder, type FailedJobReport } from './job-failure-recorder.service';

const NOW_MS = Date.UTC(2026, 10, 26, 12, 0, 0);

const report = (overrides: Partial<FailedJobReport> = {}): FailedJobReport => ({
  queue: 'ingestion',
  jobType: 'sync-show',
  schedulerJobId: null,
  attemptsExhausted: true,
  failedAtMs: NOW_MS - 1_000,
  error: new TraktApiException('429 Too Many Requests', 429),
  ...overrides,
});

describe('JobFailureRecorder', () => {
  let repository: jest.Mocked<JobFailureSummaryRepository>;
  let nowMs: number;
  let recorder: JobFailureRecorder;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    repository = {
      recordFailure: jest.fn().mockResolvedValue(undefined),
      deleteDaysBefore: jest.fn().mockResolvedValue(0),
    };
    nowMs = NOW_MS;
    recorder = new JobFailureRecorder(repository, { now: () => new Date(nowMs) });
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it('records a classified failure with a redacted message', async () => {
    await recorder.record(
      report({ error: new TraktApiException('Rate limited, see https://x.io/a?key=secret', 429) }),
    );

    expect(repository.recordFailure).toHaveBeenCalledWith({
      queue: 'ingestion',
      jobType: 'sync-show',
      schedulerJobId: null,
      errorClass: JobFailureClass.RATE_LIMIT,
      attemptsExhausted: true,
      failedAt: new Date(NOW_MS - 1_000),
      message: 'Trakt API: Rate limited, see https://x.io/a',
    });
  });

  it('uses the clock when the job has no finish time', async () => {
    await recorder.record(report({ failedAtMs: undefined }));

    expect(repository.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ failedAt: new Date(NOW_MS) }),
    );
  });

  it('never throws when the database rejects the write, which the repository already logged', async () => {
    repository.recordFailure.mockRejectedValue(new DatabaseException('connection refused'));

    await expect(recorder.record(report())).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    expect(repository.deleteDaysBefore).not.toHaveBeenCalled();
  });

  it('logs the reason of an unexpected recording error', async () => {
    repository.recordFailure.mockRejectedValue(new TypeError('boom'));

    await expect(recorder.record(report())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Failure of ingestion/sync-show not recorded: boom');
  });

  it('prunes old days at most once a day', async () => {
    await recorder.record(report());
    await recorder.record(report());
    nowMs += MS_PER_DAY;
    await recorder.record(report());

    expect(repository.deleteDaysBefore.mock.calls).toEqual([
      [new Date(NOW_MS - JOB_FAILURE_RETENTION_DAYS * MS_PER_DAY)],
      [new Date(NOW_MS + MS_PER_DAY - JOB_FAILURE_RETENTION_DAYS * MS_PER_DAY)],
    ]);
  });

  it('logs and swallows a failed prune', async () => {
    repository.deleteDaysBefore.mockRejectedValue(new TypeError('timeout'));

    await expect(recorder.record(report())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Old job failure days not pruned: timeout');
  });
});
