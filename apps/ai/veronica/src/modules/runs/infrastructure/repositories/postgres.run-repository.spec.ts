import {
  FixedClock,
  Run,
  RunStatus,
  RunStopReason,
  RunTrigger,
  type RunSnapshot,
} from '@ratingo/ai-core';

import {
  describeWithDatabase,
  openTestDatabase,
  type TestDatabase,
} from '../../../../testing/test-database';

import { PostgresRunRepository } from './postgres.run-repository';

const startedRun = (id: string, agent: string, task: string, atMs: number): Run =>
  Run.start({ id, agent, task, trigger: RunTrigger.SCHEDULE, model: 'fast' }, new FixedClock(atMs));

describeWithDatabase('PostgresRunRepository', () => {
  let database: TestDatabase;
  let repository: PostgresRunRepository;

  beforeAll(() => {
    database = openTestDatabase();
    repository = new PostgresRunRepository(database.db);
  });
  beforeEach(() => database.reset());
  afterAll(() => database.close());

  it('saves a run and updates the same row when it finishes', async () => {
    const run = startedRun('r1', 'veronica', 'daily-digest', 1000);
    await repository.save(run.snapshot());
    expect(await repository.findRunning('veronica')).toHaveLength(1);
    run.finish(RunStopReason.END, new FixedClock(2000));
    await repository.save(run.snapshot());
    expect(await repository.findRunning('veronica')).toEqual([]);
  });

  it('round-trips a snapshot through findRunning', async () => {
    const snapshot: RunSnapshot = startedRun('r2', 'veronica', 'daily-digest', 1000).snapshot();
    await repository.save(snapshot);
    expect((await repository.findRunning('veronica'))[0]).toEqual(snapshot);
    expect(snapshot.status).toBe(RunStatus.RUNNING);
  });

  it('sums spend by agent, task and time window', async () => {
    const spend = async (id: string, agent: string, task: string, atMs: number, cost: number) => {
      const snapshot = startedRun(id, agent, task, atMs).snapshot();
      await repository.save({ ...snapshot, costUsd: cost });
    };
    await spend('a', 'veronica', 'daily-digest', 5000, 0.25);
    await spend('b', 'veronica', 'other', 5000, 0.5);
    await spend('c', 'veronica', 'daily-digest', 100, 1);
    await spend('d', 'happy', 'daily-digest', 5000, 2);
    expect(await repository.spentUsd({ agent: 'veronica', sinceMs: 1000 })).toBeCloseTo(0.75);
    expect(
      await repository.spentUsd({ agent: 'veronica', task: 'daily-digest', sinceMs: 1000 }),
    ).toBeCloseTo(0.25);
  });
});
