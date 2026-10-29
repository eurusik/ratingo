import { EventEmitter } from 'node:events';

import { WorkerHost } from '@nestjs/bullmq';
import { type DiscoveryService } from '@nestjs/core';

import { metrics } from '@opentelemetry/api';

import { QueueJobMetricsService } from './queue-job-metrics.service';
import { QUEUE_JOB_DURATION_METRIC } from './telemetry.constants';
import { createTestMeterProvider } from './telemetry.testing';

class FakeWorkerHost extends WorkerHost {
  constructor(private readonly fakeWorker: EventEmitter & { name: string }) {
    super();
  }

  get worker() {
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
    new QueueJobMetricsService(discovery).onApplicationBootstrap();
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
  });
});
