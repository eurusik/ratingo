import { Logger } from '@nestjs/common';

import { DatabaseException } from '@/common/exceptions/database.exception';
import { TraktApiException } from '@/common/exceptions/external-api.exception';
import { JobFailureClass } from '@/modules/job-failures/domain/constants/job-failure-class.constants';
import { MS_PER_DAY } from '@/modules/job-failures/domain/constants/job-failure.constants';
import { type JobFailureTally } from '@/modules/job-failures/domain/entities/job-failure-tally.entity';
import { type JobFailureSummaryRepository } from '@/modules/job-failures/domain/repositories/job-failure-summary.repository';

import {
  JOB_FAILURE_BATCH_MAX_ROWS,
  JOB_FAILURE_FLUSH_INTERVAL_MS,
  JOB_FAILURE_SHUTDOWN_FLUSH_TIMEOUT_MS,
} from '../job-failure-recording.constants';

import { JobFailureRecorder, type FailedJobReport } from './job-failure-recorder.service';

const NOW_MS = Date.UTC(2026, 10, 26, 12, 0, 0);
const RATE_LIMIT_MESSAGE = 'Trakt API: 429 Too Many Requests';

const report = (overrides: Partial<FailedJobReport> = {}): FailedJobReport => ({
  queue: 'ingestion',
  jobType: 'sync-show',
  schedulerJobId: null,
  attemptsExhausted: false,
  failedAtMs: NOW_MS - 1_000,
  error: new TraktApiException('429 Too Many Requests', 429),
  ...overrides,
});

describe('JobFailureRecorder', () => {
  let repository: jest.Mocked<JobFailureSummaryRepository>;
  let written: JobFailureTally[][];
  let nowMs: number;
  let recorder: JobFailureRecorder;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    written = [];
    repository = {
      addTallies: jest.fn(async (tallies: readonly JobFailureTally[]) => {
        written.push([...tallies]);
      }),
      deleteDaysOlderThan: jest.fn().mockResolvedValue(0),
    };
    nowMs = NOW_MS;
    recorder = new JobFailureRecorder(repository, { now: () => new Date(nowMs) });
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    jest.useRealTimers();
  });

  const afterFlushInterval = async (): Promise<void> => {
    await jest.advanceTimersByTimeAsync(JOB_FAILURE_FLUSH_INTERVAL_MS);
  };

  it('writes nothing until the flush interval has passed', async () => {
    recorder.record(report());
    await jest.advanceTimersByTimeAsync(JOB_FAILURE_FLUSH_INTERVAL_MS - 1);

    expect(repository.addTallies).not.toHaveBeenCalled();
  });

  it('turns a storm of failures on one row into a single upsert', async () => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      recorder.record(
        report({ attemptsExhausted: attempt % 3 === 0, failedAtMs: NOW_MS - 10_000 + attempt }),
      );
    }
    await afterFlushInterval();

    expect(repository.addTallies).toHaveBeenCalledTimes(1);
    expect(written[0]).toEqual([
      {
        day: '2026-11-26',
        queue: 'ingestion',
        jobType: 'sync-show',
        schedulerJobId: null,
        errorClass: JobFailureClass.RATE_LIMIT,
        failureCount: 300,
        exhaustedCount: 100,
        firstFailedAtMs: NOW_MS - 10_000,
        lastFailedAtMs: NOW_MS - 10_000 + 299,
        lastMessage: RATE_LIMIT_MESSAGE,
      },
    ]);
  });

  it('keeps Kyiv days, classes and schedulers apart and redacts the message', async () => {
    recorder.record(report({ failedAtMs: Date.UTC(2026, 10, 25, 21, 59) }));
    recorder.record(report({ failedAtMs: Date.UTC(2026, 10, 25, 22, 1) }));
    recorder.record(report({ schedulerJobId: 'scheduled-trending' }));
    recorder.record(
      report({ error: new Error('GET https://x.io/a?apikey=k3y9Zq7Lm2Xc8Vb4Nn6Ty1Rr5 not found') }),
    );
    await afterFlushInterval();

    expect(
      written[0].map((tally) => [
        tally.day,
        tally.schedulerJobId,
        tally.errorClass,
        tally.lastMessage,
      ]),
    ).toEqual([
      ['2026-11-25', null, JobFailureClass.RATE_LIMIT, RATE_LIMIT_MESSAGE],
      ['2026-11-26', null, JobFailureClass.RATE_LIMIT, RATE_LIMIT_MESSAGE],
      ['2026-11-26', 'scheduled-trending', JobFailureClass.RATE_LIMIT, RATE_LIMIT_MESSAGE],
      ['2026-11-26', null, JobFailureClass.NOT_FOUND, 'GET https://x.io/a not found'],
    ]);
  });

  it('uses the clock when the job has no finish time', async () => {
    recorder.record(report({ failedAtMs: undefined }));
    await afterFlushInterval();

    expect(written[0][0]).toMatchObject({ firstFailedAtMs: NOW_MS, lastFailedAtMs: NOW_MS });
  });

  it('bounds the rows waiting for one flush and says how many failures it dropped', async () => {
    for (let index = 0; index < JOB_FAILURE_BATCH_MAX_ROWS + 5; index += 1) {
      recorder.record(report({ jobType: `job-${index}` }));
    }
    recorder.record(report({ jobType: 'job-0' }));
    await afterFlushInterval();

    expect(written[0]).toHaveLength(JOB_FAILURE_BATCH_MAX_ROWS);
    expect(written[0][0].failureCount).toBe(2);
    expect(warn).toHaveBeenCalledWith(
      `5 job failures not counted: more than ${JOB_FAILURE_BATCH_MAX_ROWS} rows waited for one flush`,
    );
  });

  it('never throws and leaves the database error to the repository log', async () => {
    repository.addTallies.mockRejectedValue(new DatabaseException('connection refused'));

    expect(() => recorder.record(report())).not.toThrow();
    await afterFlushInterval();

    expect(warn).not.toHaveBeenCalled();
    expect(repository.deleteDaysOlderThan).not.toHaveBeenCalled();
  });

  it('logs the reason of an unexpected write error', async () => {
    repository.addTallies.mockRejectedValue(new TypeError('boom'));

    recorder.record(report());
    recorder.record(report());
    await afterFlushInterval();

    expect(warn).toHaveBeenCalledWith('2 job failures in 1 rows not recorded: boom');
  });

  it('prunes by Kyiv today at most once a day', async () => {
    recorder.record(report());
    await afterFlushInterval();
    recorder.record(report());
    await afterFlushInterval();
    nowMs += MS_PER_DAY;
    recorder.record(report());
    await afterFlushInterval();

    expect(repository.deleteDaysOlderThan.mock.calls).toEqual([
      ['2026-11-26', 14],
      ['2026-11-27', 14],
    ]);
  });

  it('writes what is pending on shutdown without waiting for the timer', async () => {
    recorder.record(report());

    await recorder.onApplicationShutdown();
    await afterFlushInterval();

    expect(written).toHaveLength(1);
  });

  it('gives up on a hanging write at shutdown and logs why', async () => {
    repository.addTallies.mockImplementation(() => new Promise(() => undefined));
    recorder.record(report());

    const shutdown = recorder.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(JOB_FAILURE_SHUTDOWN_FLUSH_TIMEOUT_MS);
    await shutdown;

    expect(warn).toHaveBeenCalledWith(
      `Job failures lost on shutdown: job failure flush exceeded ${JOB_FAILURE_SHUTDOWN_FLUSH_TIMEOUT_MS}ms`,
    );
  });
});
