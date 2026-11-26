import { EventEmitter } from 'node:events';

import { WorkerHost } from '@nestjs/bullmq';
import { type DiscoveryService } from '@nestjs/core';

import { metrics } from '@opentelemetry/api';

import { type JobFailureRecorder } from '../modules/job-failures/public';

import { QueueJobMetricsService } from './queue-job-metrics.service';
import { scheduledJobNames } from './scheduler-last-run.gauge';
import { QUEUE_JOB_DURATION_METRIC, SCHEDULER_LAST_RUN_METRIC } from './telemetry.constants';
import { createTestMeterProvider } from './telemetry.testing';

class FakeWorkerHost extends WorkerHost {
  constructor(private readonly fakeWorker: EventEmitter & { name: string }) {
    super();
  }

  override get worker() {
    return this.fakeWorker as never;
  }

  async process(): Promise<void> {}
}

const fakeWorker = (name: string) => Object.assign(new EventEmitter(), { name });

const job = (overrides: Record<string, unknown> = {}) => ({
  name: 'sync-movie',
  processedOn: 1_000,
  finishedOn: 3_500,
  attemptsMade: 1,
  opts: { attempts: 3 },
  ...overrides,
});

describe('QueueJobMetricsService', () => {
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];
  let ingestion: ReturnType<typeof fakeWorker>;
  let recordFailure: jest.Mock;

  beforeEach(() => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    metrics.setGlobalMeterProvider(testProvider.provider);

    ingestion = fakeWorker('ingestion');
    const discovery = {
      getProviders: () => [
        { instance: new FakeWorkerHost(ingestion) },
        { instance: { notAWorker: true } },
      ],
    } as unknown as DiscoveryService;
    recordFailure = jest.fn();
    const jobFailures = { record: recordFailure } as unknown as JobFailureRecorder;
    new QueueJobMetricsService(discovery, jobFailures).onApplicationBootstrap();
  });

  afterEach(() => {
    metrics.disable();
  });

  const durations = async () =>
    (await collect(QUEUE_JOB_DURATION_METRIC)).map(({ value, attributes }) => ({
      count: (value as { count: number }).count,
      sum: (value as { sum: number }).sum,
      attributes,
    }));

  it('records completed jobs with their duration, queue and job name', async () => {
    ingestion.emit('completed', job());

    await expect(durations()).resolves.toEqual([
      {
        count: 1,
        sum: 2.5,
        attributes: { queue: 'ingestion', 'job.name': 'sync-movie', result: 'completed' },
      },
    ]);
  });

  it('tells a failure that will be retried from a final failure', async () => {
    ingestion.emit('failed', job({ attemptsMade: 1, finishedOn: undefined }), new Error('429'));
    ingestion.emit('failed', job({ attemptsMade: 3 }), new Error('403'));

    const results = (await durations()).map((point) => point.attributes.result);
    expect(results.sort()).toEqual(['failed', 'retried']);
  });

  it('ignores failures without a job and jobs that never started', async () => {
    ingestion.emit('failed', undefined, new Error('stalled'));
    ingestion.emit('completed', job({ processedOn: undefined }));

    await expect(durations()).resolves.toEqual([]);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('reports every failed attempt to the job failure summary', () => {
    const retried = new Error('429');
    const exhausted = new Error('403');
    ingestion.emit('failed', job({ attemptsMade: 1, finishedOn: undefined }), retried);
    ingestion.emit(
      'failed',
      job({ attemptsMade: 3, repeatJobKey: 'prod:scheduled-snapshots' }),
      exhausted,
    );

    expect(recordFailure.mock.calls).toEqual([
      [
        {
          queue: 'ingestion',
          jobType: 'sync-movie',
          schedulerJobId: null,
          attemptsExhausted: false,
          failedAtMs: undefined,
          error: retried,
        },
      ],
      [
        {
          queue: 'ingestion',
          jobType: 'sync-movie',
          schedulerJobId: 'scheduled-snapshots',
          attemptsExhausted: true,
          failedAtMs: 3_500,
          error: exhausted,
        },
      ],
    ]);
  });

  describe('scheduler last run gauge', () => {
    const lastRuns = async () =>
      (await collect(SCHEDULER_LAST_RUN_METRIC)).map(({ value, attributes }) => ({
        value,
        attributes,
      }));

    it('records the finish time of a scheduled job as success', async () => {
      ingestion.emit('completed', job({ repeatJobKey: 'prod:scheduled-snapshots' }));

      await expect(lastRuns()).resolves.toEqual([
        { value: 3.5, attributes: { job_name: 'scheduled-snapshots', result: 'success' } },
      ]);
    });

    it('keeps success and failure as separate series and overwrites on a newer run', async () => {
      ingestion.emit('completed', job({ repeatJobKey: 'prod:scheduled-snapshots' }));
      ingestion.emit(
        'completed',
        job({ repeatJobKey: 'prod:scheduled-snapshots', finishedOn: 9_000 }),
      );
      ingestion.emit(
        'failed',
        job({ repeatJobKey: 'prod:scheduled-snapshots', attemptsMade: 3, finishedOn: 12_000 }),
        new Error('boom'),
      );

      const points = (await lastRuns()).sort((a, b) =>
        String(a.attributes.result).localeCompare(String(b.attributes.result)),
      );
      expect(points).toEqual([
        { value: 12, attributes: { job_name: 'scheduled-snapshots', result: 'failure' } },
        { value: 9, attributes: { job_name: 'scheduled-snapshots', result: 'success' } },
      ]);
    });

    it('does not record a failure that will be retried', async () => {
      ingestion.emit(
        'failed',
        job({ repeatJobKey: 'prod:scheduled-snapshots', attemptsMade: 1 }),
        new Error('429'),
      );

      await expect(lastRuns()).resolves.toEqual([]);
    });

    it('accepts every registered scheduler id', async () => {
      const names = [...scheduledJobNames()];
      expect(names).toEqual(
        expect.arrayContaining([
          'scheduled-tracked-shows',
          'scheduled-snapshots',
          'scheduled-trending',
          'scheduled-now-playing',
          'scheduled-now-playing-flags',
          'scheduled-new-releases',
          'scheduled-upcoming-movies',
          'scheduled-upcoming-movies-refresh-soon',
          'scheduled-upcoming-movies-refresh-all',
          'scheduled-mdblist-ratings',
          'scheduled-key-health',
          'movie-release-notifications',
          'link-pending-imports',
        ]),
      );
      names.forEach((name) => ingestion.emit('completed', job({ repeatJobKey: `prod:${name}` })));

      await expect(lastRuns()).resolves.toHaveLength(names.length);
    });

    it('falls back to the current time when the job has no finish time', async () => {
      jest.useFakeTimers().setSystemTime(50_000);
      ingestion.emit(
        'failed',
        job({ repeatJobKey: 'prod:scheduled-snapshots', attemptsMade: 3, finishedOn: undefined }),
        new Error('boom'),
      );
      jest.useRealTimers();

      await expect(lastRuns()).resolves.toEqual([
        { value: 50, attributes: { job_name: 'scheduled-snapshots', result: 'failure' } },
      ]);
    });

    it('ignores per-item jobs and unknown scheduler keys', async () => {
      ingestion.emit('completed', job());
      ingestion.emit('completed', job({ repeatJobKey: 'prod:scheduled-something-else' }));
      ingestion.emit('completed', job({ repeatJobKey: 'not-namespaced' }));

      await expect(lastRuns()).resolves.toEqual([]);
    });
  });
});
