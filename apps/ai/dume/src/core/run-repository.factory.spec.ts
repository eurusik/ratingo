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

import { createRunRepository } from './run-repository.factory';

const NOON = Date.UTC(2026, 10, 27, 12, 0, 0);

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

const finishedRun = (costUsd: number) => {
  const clock = new FixedClock(NOON);
  const run = Run.start(
    { id: 'run-1', agent: 'dume', task: 'investigate', trigger: RunTrigger.CHAT, model: 'm' },
    clock,
  );
  run.recordTurn(EMPTY_USAGE, costUsd, 'm');
  run.finish(RunStopReason.END, clock);
  return run.snapshot();
};

const build = (redis: RedisSpendClient | null, warn = jest.fn()) => {
  const probe = createRecordingMeter();
  const repository = createRunRepository({
    meter: probe.meter,
    clock: new FixedClock(NOON),
    runLogger: { info: jest.fn() },
    spendLogger: { warn },
    redis,
  });
  return { probe, repository, warn };
};

describe('createRunRepository', () => {
  it('keeps the daily spend across a restart when Redis is configured', async () => {
    const redis = sharedRedis();
    await build(redis).repository.save(finishedRun(0.7));

    const afterRestart = build(redis).repository;

    expect(await afterRestart.spentUsd({ agent: 'dume', sinceMs: NOON - 1000 })).toBeCloseTo(0.7);
  });

  it('counts per process and warns when Redis is not configured', async () => {
    const { repository, warn } = build(null);
    await repository.save(finishedRun(0.7));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(await repository.spentUsd({ agent: 'dume', sinceMs: NOON - 1000 })).toBeCloseTo(0.7);
  });

  it('records every finished run as app.ai.runs, the way every agent must', async () => {
    const { repository, probe } = build(sharedRedis());

    await repository.save(finishedRun(0.1));

    expect(probe.recorded(AI_METRIC_NAMES.RUNS)).toEqual([
      {
        value: 1,
        attributes: expect.objectContaining({ [AI_METRIC_ATTRIBUTES.AGENT]: 'dume' }),
      },
    ]);
  });
});
