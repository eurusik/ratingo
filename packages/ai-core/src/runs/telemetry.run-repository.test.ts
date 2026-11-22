import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { FixedClock } from '../clock/fixed.clock';
import { InMemoryRunRepository } from './in-memory.run-repository';
import { EMPTY_USAGE } from '../model/model.types';
import { AI_METRIC_NAMES } from '../telemetry/ai-metric-names';
import { Run, RunStopReason, RunTrigger } from './run';
import { RUN_FINISHED_EVENT, TelemetryRunRepository } from './telemetry.run-repository';

class TestMetricReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

interface Point {
  value: unknown;
  attributes: Record<string, unknown>;
}

describe('TelemetryRunRepository', () => {
  let reader: TestMetricReader;
  let repository: TelemetryRunRepository;
  const logger = { info: jest.fn() };

  const points = async (metricName: string): Promise<Point[]> => {
    const { resourceMetrics } = await reader.collect();
    const metric = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((candidate) => candidate.descriptor.name === metricName);
    return (metric?.dataPoints ?? []) as unknown as Point[];
  };

  beforeEach(() => {
    logger.info.mockClear();
    reader = new TestMetricReader();
    const provider = new MeterProvider({ readers: [reader] });
    repository = new TelemetryRunRepository(
      provider.getMeter('ai-core-test'),
      logger,
      new InMemoryRunRepository(),
    );
  });

  const finishedRun = (stopReason: RunStopReason) => {
    const clock = new FixedClock(1_000);
    const run = Run.start(
      {
        id: 'run-1',
        agent: 'veronica',
        task: 'daily-digest',
        trigger: RunTrigger.SCHEDULE,
        model: 'stub:m',
      },
      clock,
    );
    run.recordTurn({ ...EMPTY_USAGE, inputTokens: 100, outputTokens: 20 }, 0.004, 'stub:m');
    run.recordToolCall('prom_query');
    clock.advance(2_500);
    run.finish(stopReason, clock);
    return run.snapshot();
  };

  it('emits nothing while a run is still running', async () => {
    const clock = new FixedClock();
    const run = Run.start(
      { id: 'r', agent: 'veronica', trigger: RunTrigger.MANUAL, model: 'stub:m' },
      clock,
    );

    await repository.save(run.snapshot());

    expect(await points(AI_METRIC_NAMES.RUNS)).toEqual([]);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('counts a finished run by outcome', async () => {
    await repository.save(finishedRun(RunStopReason.BUDGET_EXCEEDED));

    const [point] = await points(AI_METRIC_NAMES.RUNS);

    expect(point?.value).toBe(1);
    expect(point?.attributes).toEqual({
      agent: 'veronica',
      task: 'daily-digest',
      trigger: 'schedule',
      outcome: 'budget_exceeded',
    });
  });

  it('records tokens by kind', async () => {
    await repository.save(finishedRun(RunStopReason.END));

    const tokens = await points(AI_METRIC_NAMES.RUN_TOKENS);

    const byKind = Object.fromEntries(tokens.map((point) => [point.attributes.kind, point.value]));
    expect(byKind).toMatchObject({ input: 100, output: 20, cache_read: 0 });
  });

  it('records cost and duration', async () => {
    await repository.save(finishedRun(RunStopReason.END));

    const [duration] = await points(AI_METRIC_NAMES.RUN_DURATION);
    const [cost] = await points(AI_METRIC_NAMES.RUN_COST);

    expect((duration?.value as { sum: number }).sum).toBeCloseTo(2.5);
    expect((cost?.value as { sum: number }).sum).toBeCloseTo(0.004);
  });

  it('counts tool calls per tool', async () => {
    await repository.save(finishedRun(RunStopReason.END));

    const [toolCalls] = await points(AI_METRIC_NAMES.TOOL_CALLS);

    expect(toolCalls).toMatchObject({ value: 1, attributes: { tool: 'prom_query' } });
  });

  it('reports a run once even if the finished snapshot is saved twice', async () => {
    const run = finishedRun(RunStopReason.END);
    await repository.save(run);
    await repository.save(run);

    const [point] = await points(AI_METRIC_NAMES.RUNS);

    expect(point?.value).toBe(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('keeps the metric names that Grafana dashboards query', () => {
    expect(AI_METRIC_NAMES).toEqual({
      RUNS: 'app.ai.runs',
      RUN_COST: 'app.ai.run.cost',
      RUN_TOKENS: 'app.ai.run.tokens',
      RUN_DURATION: 'app.ai.run.duration',
      TOOL_CALLS: 'app.ai.tool.calls',
      CHAT_EVENTS: 'app.ai.chat.events',
      WATCHDOG_LAST_TICK: 'app.ai.watchdog.last_tick_timestamp_seconds',
    });
  });

  it('logs ids and outcomes without prompts or tool output', async () => {
    await repository.save(finishedRun(RunStopReason.END));

    expect(logger.info).toHaveBeenCalledWith(RUN_FINISHED_EVENT, {
      runId: 'run-1',
      agent: 'veronica',
      task: 'daily-digest',
      trigger: 'schedule',
      status: 'completed',
      stopReason: 'end',
      turns: 1,
      costUsd: 0.004,
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });

  it('keeps answering spend queries from its store', async () => {
    await repository.save(finishedRun(RunStopReason.END));

    expect(await repository.spentUsd({ agent: 'veronica', sinceMs: 0 })).toBeCloseTo(0.004);
    expect(await repository.findRunning('veronica')).toEqual([]);
  });
});
