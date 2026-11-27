import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';

import {
  AI_METRIC_ATTRIBUTES,
  AI_METRIC_NAMES,
  EMPTY_USAGE,
  FixedClock,
  RUN_REPOSITORY,
  Run,
  RunStopReason,
  RunTrigger,
  type RunRepository,
} from '@ratingo/ai-core';

import { DATABASE } from '../../database/database.constants';

import { RunsModule } from './runs.module';

class TestMetricReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

@Module({})
class FakeDatabaseModule {}

const fakeDatabase = {
  insert: () => ({ values: () => ({ onConflictDoUpdate: async () => undefined }) }),
};

const finishedChatRun = () => {
  const clock = new FixedClock(Date.UTC(2026, 10, 27, 9, 0, 0));
  const run = Run.start(
    { id: 'run-1', agent: 'veronica', task: 'chat', trigger: RunTrigger.CHAT, model: 'm' },
    clock,
  );
  run.recordTurn(EMPTY_USAGE, 0.012, 'm');
  run.finish(RunStopReason.END, clock);
  return run.snapshot();
};

describe('the run repository Veronica runs on', () => {
  let reader: TestMetricReader;

  beforeEach(() => {
    metrics.disable();
    reader = new TestMetricReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
  });
  afterAll(() => metrics.disable());

  const recordedRuns = async () => {
    const { resourceMetrics } = await reader.collect();
    const points = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .filter((metric) => metric.descriptor.name === AI_METRIC_NAMES.RUNS)
      .flatMap((metric) => metric.dataPoints as { value: number; attributes: unknown }[]);
    return points;
  };

  it.each([
    ['postgres', () => RunsModule.postgres()],
    ['in-memory', () => RunsModule.inMemory()],
  ])('records every finished run as app.ai.runs with the %s store', async (_name, build) => {
    const databaseModule = {
      module: FakeDatabaseModule,
      providers: [{ provide: DATABASE, useValue: fakeDatabase }],
      exports: [DATABASE],
      global: true,
    };
    const testing = await Test.createTestingModule({ imports: [databaseModule, build()] }).compile();
    const repository = testing.get<RunRepository>(RUN_REPOSITORY);

    await repository.save(finishedChatRun());

    const [point] = await recordedRuns();
    expect(point?.value).toBe(1);
    expect(point?.attributes).toEqual({
      [AI_METRIC_ATTRIBUTES.AGENT]: 'veronica',
      [AI_METRIC_ATTRIBUTES.TASK]: 'chat',
      [AI_METRIC_ATTRIBUTES.TRIGGER]: 'chat',
      [AI_METRIC_ATTRIBUTES.OUTCOME]: 'end',
    });
  });
});
