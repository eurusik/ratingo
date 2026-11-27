import { FixedClock } from '../clock/fixed.clock';
import { EMPTY_USAGE } from '../model/model.types';
import { AI_METRIC_ATTRIBUTES, AI_METRIC_NAMES } from '../telemetry/ai-metric-names';
import { createRecordingMeter } from '../testing/recording-meter';
import { createRunRepository } from './create-run-repository';
import { InMemoryRunRepository } from './in-memory.run-repository';
import { Run, RunStopReason, RunTrigger } from './run';
import type { RedisSpendClient } from './redis.spend-store';

const NOON = Date.UTC(2026, 10, 22, 12, 0, 0);
const WARNING = 'process-local spend';

const finishedRun = (agent: string, costUsd: number) => {
  const clock = new FixedClock(NOON);
  const run = Run.start(
    { id: `run-${agent}`, agent, task: 'chat', trigger: RunTrigger.CHAT, model: 'm' },
    clock,
  );
  run.recordTurn(EMPTY_USAGE, costUsd, 'm');
  run.finish(RunStopReason.END, clock);
  return run.snapshot();
};

const redisClient = (): RedisSpendClient => {
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

describe('createRunRepository', () => {
  const build = (durable: 'none' | 'redis' | 'process-local') => {
    const probe = createRecordingMeter();
    const warn = jest.fn();
    const repository = createRunRepository({
      base: new InMemoryRunRepository(),
      meter: probe.meter,
      runLogger: { info: jest.fn() },
      ...(durable === 'none'
        ? {}
        : {
            durableSpend: {
              redis: durable === 'redis' ? redisClient() : null,
              keyPrefix: 'ai:test',
              clock: new FixedClock(NOON),
              logger: { warn },
              processLocalWarning: WARNING,
            },
          }),
    });
    return { probe, repository, warn };
  };

  it.each(['none', 'redis', 'process-local'] as const)(
    'records the finished run as app.ai.runs and app.ai.run.cost with %s spend tracking',
    async (durable) => {
      const { probe, repository } = build(durable);

      await repository.save(finishedRun('veronica', 0.02));

      expect(probe.recorded(AI_METRIC_NAMES.RUNS)).toEqual([
        {
          value: 1,
          attributes: {
            [AI_METRIC_ATTRIBUTES.AGENT]: 'veronica',
            [AI_METRIC_ATTRIBUTES.TASK]: 'chat',
            [AI_METRIC_ATTRIBUTES.TRIGGER]: 'chat',
            [AI_METRIC_ATTRIBUTES.OUTCOME]: 'end',
          },
        },
      ]);
      expect(probe.recorded(AI_METRIC_NAMES.RUN_COST).map((point) => point.value)).toEqual([0.02]);
    },
  );

  it('warns once when durable spend is asked for but Redis is not configured', () => {
    const { warn } = build('process-local');

    expect(warn).toHaveBeenCalledWith(WARNING);
  });

  it('keeps the base repository as the source of spend when there is no durable store', async () => {
    const { repository } = build('none');
    await repository.save(finishedRun('veronica', 0.02));

    expect(await repository.spentUsd({ agent: 'veronica', sinceMs: NOON - 1000 })).toBeCloseTo(
      0.02,
    );
  });
});
