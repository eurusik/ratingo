import { FixedClock } from '../clock/fixed.clock';
import { AgentLoop } from '../loop/agent-loop';
import { StubModelAdapter } from '../model/adapters/stub/stub.model-adapter';
import { StubScenario, createStubScript } from '../model/adapters/stub/stub.scenarios';
import { EMPTY_USAGE } from '../model/model.types';
import { ToolRegistry } from '../tools/tool-registry';
import { DurableSpendRunRepository } from './durable-spend.run-repository';
import { InMemoryRunRepository } from './in-memory.run-repository';
import { RedisSpendStore } from './redis.spend-store';
import type { RedisSpendClient } from './redis.spend-store';
import { Run, RunStatus, RunStopReason, RunTrigger } from './run';
import type { SpendStore } from './spend-store.port';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOON = Date.UTC(2026, 10, 22, 12, 0, 0);

class MapSpendStore implements SpendStore {
  readonly ttls = new Map<string, number>();
  failing = false;
  private readonly totals = new Map<string, number>();

  async add(key: string, usd: number, ttlSeconds: number): Promise<void> {
    this.guard();
    this.totals.set(key, (this.totals.get(key) ?? 0) + usd);
    this.ttls.set(key, ttlSeconds);
  }

  async total(key: string): Promise<number> {
    this.guard();
    return this.totals.get(key) ?? 0;
  }

  private guard(): void {
    if (this.failing) {
      throw new Error('redis down');
    }
  }
}

const finishedRun = (
  clock: FixedClock,
  id: string,
  costUsd: number,
  task: string | undefined = 'review',
) => {
  const run = Run.start(
    { id, agent: 'happy', trigger: RunTrigger.MANUAL, model: 'stub:m', ...(task ? { task } : {}) },
    clock,
  );
  run.recordTurn(EMPTY_USAGE, costUsd, 'stub:m');
  run.finish(RunStopReason.END, clock);
  return run.snapshot();
};

const create = (store: SpendStore, clock: FixedClock, warn = jest.fn()) => ({
  repository: new DurableSpendRunRepository(new InMemoryRunRepository(), store, clock, { warn }),
  warn,
});

describe('DurableSpendRunRepository', () => {
  it('keeps the day spend across a new repository instance', async () => {
    const clock = new FixedClock(NOON);
    const store = new MapSpendStore();
    await create(store, clock).repository.save(finishedRun(clock, 'a', 0.4));

    const afterRestart = create(store, clock).repository;

    expect(
      await afterRestart.spentUsd({ agent: 'happy', sinceMs: NOON - 12 * 60 * 60 * 1000 }),
    ).toBeCloseTo(0.4);
    expect(
      await afterRestart.spentUsd({ agent: 'happy', task: 'review', sinceMs: NOON - 1000 }),
    ).toBeCloseTo(0.4);
    expect(await afterRestart.spentUsd({ agent: 'happy', task: 'triage', sinceMs: 0 })).toBe(0);
    expect(await afterRestart.spentUsd({ agent: 'veronica', sinceMs: 0 })).toBe(0);
  });

  it('counts a finished run once however often it is saved', async () => {
    const clock = new FixedClock(NOON);
    const { repository } = create(new MapSpendStore(), clock);
    const run = finishedRun(clock, 'a', 0.25);

    await repository.save(run);
    await repository.save(run);

    expect(await repository.spentUsd({ agent: 'happy', sinceMs: NOON - 1000 })).toBeCloseTo(0.25);
  });

  it('stores the spend of every turn, so a run killed mid-flight is not lost', async () => {
    const clock = new FixedClock(NOON);
    const store = new MapSpendStore();
    const { repository } = create(store, clock);
    const run = Run.start(
      { id: 'r', agent: 'happy', task: 'review', trigger: RunTrigger.MANUAL, model: 'stub:m' },
      clock,
    );
    const query = { agent: 'happy', sinceMs: NOON - 1000 };

    run.recordTurn(EMPTY_USAGE, 0.1, 'stub:m');
    await repository.save(run.snapshot());
    run.recordTurn(EMPTY_USAGE, 0.2, 'stub:m');
    await repository.save(run.snapshot());

    expect(run.snapshot().status).toBe(RunStatus.RUNNING);
    expect(await create(store, clock).repository.spentUsd(query)).toBeCloseTo(0.3);

    run.finish(RunStopReason.END, clock);
    await repository.save(run.snapshot());
    expect(await repository.spentUsd(query)).toBeCloseTo(0.3);
  });

  it('stores nothing for a free run', async () => {
    const clock = new FixedClock(NOON);
    const store = new MapSpendStore();

    await create(store, clock).repository.save(finishedRun(clock, 'free', 0));

    expect(store.ttls.size).toBe(0);
  });

  it('reads today when the query starts after the clock', async () => {
    const clock = new FixedClock(NOON);
    const { repository } = create(new MapSpendStore(), clock);
    await repository.save(finishedRun(clock, 'a', 0.4));

    expect(await repository.spentUsd({ agent: 'happy', sinceMs: NOON + 2 * DAY_MS })).toBeCloseTo(
      0.4,
    );
  });

  it('separates days and expires the keys after two days', async () => {
    const clock = new FixedClock(NOON);
    const store = new MapSpendStore();
    const { repository } = create(store, clock);
    await repository.save(finishedRun(clock, 'today', 0.5));

    const tomorrow = new FixedClock(NOON + DAY_MS);
    const next = create(store, tomorrow).repository;

    expect(await next.spentUsd({ agent: 'happy', sinceMs: NOON + DAY_MS - 1000 })).toBe(0);
    expect(await next.spentUsd({ agent: 'happy', sinceMs: NOON - 1000 })).toBeCloseTo(0.5);
    expect([...store.ttls.values()].every((ttl) => ttl === 48 * 60 * 60)).toBe(true);
  });

  it('falls back to this process when the store fails, and says so', async () => {
    const clock = new FixedClock(NOON);
    const store = new MapSpendStore();
    const { repository, warn } = create(store, clock);
    await repository.save(finishedRun(clock, 'a', 0.3));
    store.failing = true;

    expect(await repository.spentUsd({ agent: 'happy', sinceMs: NOON - 1000 })).toBeCloseTo(0.3);
    await repository.save(finishedRun(clock, 'b', 0.2));

    expect(warn).toHaveBeenCalledTimes(2);
    expect(await repository.spentUsd({ agent: 'happy', sinceMs: NOON - 1000 })).toBeCloseTo(0.5);
  });

  it('blocks the next model call once the stored day spend exceeds the budget', async () => {
    const clock = new FixedClock(NOON);
    const store = new MapSpendStore();
    await create(store, clock).repository.save(finishedRun(clock, 'old', 2.95));
    const { repository } = create(store, clock);
    const model = new StubModelAdapter(createStubScript(StubScenario.NORMAL));
    const price = {
      inputPerMTokUsd: 10,
      outputPerMTokUsd: 10,
      cacheReadPerMTokUsd: 10,
      cacheWritePerMTokUsd: 10,
      reasoningPerMTokUsd: 10,
    };
    const loop = new AgentLoop({
      providers: { stub: model },
      registry: await ToolRegistry.create([], []),
      runs: repository,
      clock,
      prices: { 'stub:m': price },
    });
    const sinceMs = NOON - 12 * 60 * 60 * 1000;

    const result = await loop.run(
      Run.start({ id: 'new', agent: 'happy', trigger: RunTrigger.MANUAL, model: 'stub:m' }, clock),
      {
        models: [{ provider: 'stub', model: 'm' }],
        system: 's',
        prompt: 'p',
        budgets: { perRunUsd: 5, perDayUsd: 3 },
        priorSpend: {
          taskUsd: 0,
          agentDayUsd: await repository.spentUsd({ agent: 'happy', sinceMs }),
        },
        limits: { maxTurns: 3, timeoutMs: 60_000, maxTokensPerCall: 10_000, callTimeoutMs: 10_000 },
      },
    );

    expect(result.run.stopReason).toBe(RunStopReason.BUDGET_EXCEEDED);
    expect(model.requests).toHaveLength(0);
  });
});

describe('RedisSpendStore', () => {
  const fakeClient = () => {
    const values = new Map<string, number>();
    const calls: string[] = [];
    const client: RedisSpendClient = {
      incrbyfloat: async (key, increment) => {
        calls.push(`incrbyfloat ${key}`);
        values.set(key, (values.get(key) ?? 0) + increment);
        return String(values.get(key));
      },
      expire: async (key, seconds) => {
        calls.push(`expire ${key} ${seconds}`);
        return 1;
      },
      get: async (key) => (values.has(key) ? String(values.get(key)) : null),
    };
    return { client, calls };
  };

  it('adds under a prefixed key and sets the expiry', async () => {
    const { client, calls } = fakeClient();
    const store = new RedisSpendStore(client, 'ai');

    await store.add('spend:happy:2026-11-22', 0.1, 100);
    await store.add('spend:happy:2026-11-22', 0.2, 100);

    expect(calls).toContain('expire ai:spend:happy:2026-11-22 100');
    expect(await store.total('spend:happy:2026-11-22')).toBeCloseTo(0.3);
  });

  it('reads a missing key as zero and an unreadable value as zero', async () => {
    const store = new RedisSpendStore(
      {
        incrbyfloat: async () => '0',
        expire: async () => 1,
        get: async (key) => (key.endsWith('bad') ? 'not-a-number' : null),
      },
      'ai',
    );

    expect(await store.total('missing')).toBe(0);
    expect(await store.total('bad')).toBe(0);
  });
});
