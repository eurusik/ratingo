import {
  FixedClock,
  InMemoryRunRepository,
  Run,
  RunStatus,
  RunTrigger,
  type AgentFolder,
} from '@ratingo/ai-core';

import { InterruptedRunsRecovery } from './interrupted-runs.recovery';

describe('InterruptedRunsRecovery', () => {
  it('marks runs left running by a previous process as interrupted', async () => {
    const clock = new FixedClock(1000);
    const runs = new InMemoryRunRepository();
    const stale = Run.start(
      { id: 'a', agent: 'veronica', trigger: RunTrigger.SCHEDULE, model: 'fast' },
      clock,
    );
    const other = Run.start(
      { id: 'b', agent: 'happy', trigger: RunTrigger.SCHEDULE, model: 'fast' },
      clock,
    );
    await runs.save(stale.snapshot());
    await runs.save(other.snapshot());
    const folder = { manifest: { name: 'veronica' } } as unknown as AgentFolder;
    await new InterruptedRunsRecovery(folder, runs, clock).onModuleInit();
    expect(await runs.findRunning('veronica')).toEqual([]);
    expect(await runs.findRunning('happy')).toHaveLength(1);
    expect(RunStatus.INTERRUPTED).toBe('interrupted');
  });
});
