import { metrics } from '@opentelemetry/api';

import {
  AI_METRIC_ATTRIBUTES,
  AI_METRIC_NAMES,
  EMPTY_USAGE,
  FixedClock,
  Run,
  RunStopReason,
  RunTrigger,
  createRecordingMeter,
  type RedisSpendClient,
} from '@ratingo/ai-core';

import { PROCESS_LOCAL_BUDGET_WARNING, createRunRepository } from './run-repository.factory';

const NOON = Date.UTC(2026, 10, 22, 12, 0, 0);

const sharedRedis = (): RedisSpendClient => {
  const values = new Map<string, number>();
  return {
    incrbyfloat: async (key, increment) => {
      values.set(key, (values.get(key) ?? 0) + increment);
      return String(values.get(key));
    },
    expire: async () => 1,
    get: async (key) => (values.has(key) ? String(values.get(key)) : null),
  };
};

const build = (redis: RedisSpendClient | null, warn = jest.fn()) =>
  createRunRepository({
    meter: metrics.getMeter('test'),
    clock: new FixedClock(NOON),
    runLogger: { info: jest.fn() },
    spendLogger: { warn },
    redis,
  });

const finishedRun = (costUsd: number) => {
  const clock = new FixedClock(NOON);
  const run = Run.start(
    {
      id: `run-${costUsd}`,
      agent: 'happy',
      task: 'review',
      trigger: RunTrigger.MANUAL,
      model: 'm',
    },
    clock,
  );
  run.recordTurn(EMPTY_USAGE, costUsd, 'm');
  run.finish(RunStopReason.END, clock);
  return run.snapshot();
};

describe('createRunRepository', () => {
  it('keeps the daily spend across a restart when Redis is configured', async () => {
    const redis = sharedRedis();
    await build(redis).save(finishedRun(0.7));

    const afterRestart = build(redis);

    expect(await afterRestart.spentUsd({ agent: 'happy', sinceMs: NOON - 1000 })).toBeCloseTo(0.7);
  });

  it('counts per process and warns when Redis is not configured', async () => {
    const warn = jest.fn();
    const first = build(null, warn);
    await first.save(finishedRun(0.7));

    expect(warn).toHaveBeenCalledWith(PROCESS_LOCAL_BUDGET_WARNING);
    expect(await first.spentUsd({ agent: 'happy', sinceMs: NOON - 1000 })).toBeCloseTo(0.7);
    expect(await build(null).spentUsd({ agent: 'happy', sinceMs: NOON - 1000 })).toBe(0);
  });

  it('does not warn when Redis is configured', () => {
    const warn = jest.fn();
    build(sharedRedis(), warn);

    expect(warn).not.toHaveBeenCalled();
  });

  it('records every finished run as app.ai.runs, the way every agent must', async () => {
    const probe = createRecordingMeter();
    const repository = createRunRepository({
      meter: probe.meter,
      clock: new FixedClock(NOON),
      runLogger: { info: jest.fn() },
      spendLogger: { warn: jest.fn() },
      redis: sharedRedis(),
    });

    await repository.save(finishedRun(0.1));

    expect(probe.recorded(AI_METRIC_NAMES.RUNS)).toEqual([
      {
        value: 1,
        attributes: expect.objectContaining({ [AI_METRIC_ATTRIBUTES.AGENT]: 'happy' }),
      },
    ]);
  });
});
