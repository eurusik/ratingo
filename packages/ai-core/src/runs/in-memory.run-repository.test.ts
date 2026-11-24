import { FixedClock } from '../clock/fixed.clock';
import { EMPTY_USAGE } from '../model/model.types';
import { IN_MEMORY_RETENTION_MS, InMemoryRunRepository } from './in-memory.run-repository';
import { Run, RunStopReason, RunTrigger } from './run';

interface FinishedRunOptions {
  id: string;
  agent: string;
  task: string;
  costUsd: number;
}

const finishedRun = (options: FinishedRunOptions, clock: FixedClock) => {
  const { id, agent, task, costUsd } = options;
  const run = Run.start({ id, agent, task, trigger: RunTrigger.SCHEDULE, model: 'stub:m' }, clock);
  run.recordTurn(EMPTY_USAGE, costUsd, 'stub:m');
  run.finish(RunStopReason.END, clock);
  return run.snapshot();
};

describe('InMemoryRunRepository', () => {
  it('sums spend per agent, optionally per task, since a point in time', async () => {
    const clock = new FixedClock(10_000);
    const runs = new InMemoryRunRepository();
    await runs.save(
      finishedRun({ id: 'a', agent: 'veronica', task: 'digest', costUsd: 0.1 }, clock),
    );
    await runs.save(finishedRun({ id: 'b', agent: 'veronica', task: 'chat', costUsd: 0.2 }, clock));
    await runs.save(finishedRun({ id: 'c', agent: 'happy', task: 'review', costUsd: 5 }, clock));
    clock.advance(1_000);
    await runs.save(
      finishedRun({ id: 'd', agent: 'veronica', task: 'digest', costUsd: 0.4 }, clock),
    );

    expect(await runs.spentUsd({ agent: 'veronica', sinceMs: 0 })).toBeCloseTo(0.7);
    expect(await runs.spentUsd({ agent: 'veronica', task: 'digest', sinceMs: 0 })).toBeCloseTo(0.5);
    expect(await runs.spentUsd({ agent: 'veronica', sinceMs: 11_000 })).toBeCloseTo(0.4);
  });

  it('evicts finished runs after the retention window', async () => {
    const clock = new FixedClock(0);
    const runs = new InMemoryRunRepository();
    await runs.save(
      finishedRun({ id: 'old', agent: 'veronica', task: 'digest', costUsd: 1 }, clock),
    );
    clock.advance(IN_MEMORY_RETENTION_MS + 1);

    await runs.save(
      finishedRun({ id: 'new', agent: 'veronica', task: 'digest', costUsd: 2 }, clock),
    );

    expect(await runs.spentUsd({ agent: 'veronica', sinceMs: 0 })).toBeCloseTo(2);
  });
});
