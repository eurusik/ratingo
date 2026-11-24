import { FixedClock } from '../clock/fixed.clock';
import { InMemoryRunRepository } from './in-memory.run-repository';
import { markInterruptedRuns } from './interrupted-runs';
import { Run, RunStatus, RunStopReason, RunTrigger } from './run';

const start = (id: string, agent: string, clock: FixedClock): Run =>
  Run.start({ id, agent, trigger: RunTrigger.SCHEDULE, model: 'stub:m' }, clock);

describe('markInterruptedRuns', () => {
  it('marks leftover running runs of the agent and leaves others alone', async () => {
    const clock = new FixedClock(1_000);
    const runs = new InMemoryRunRepository();
    await runs.save(start('stale', 'veronica', clock).snapshot());
    await runs.save(start('other-agent', 'happy', clock).snapshot());
    const finished = start('finished', 'veronica', clock);
    finished.finish(RunStopReason.END, clock);
    await runs.save(finished.snapshot());
    clock.advance(5_000);

    const count = await markInterruptedRuns('veronica', runs, clock);

    expect(count).toBe(1);
    expect(await runs.findRunning('veronica')).toEqual([]);
    expect(await runs.findRunning('happy')).toHaveLength(1);
  });

  it('records the interruption on the run', async () => {
    const clock = new FixedClock(1_000);
    const runs = new InMemoryRunRepository();
    await runs.save(start('stale', 'veronica', clock).snapshot());
    const save = jest.spyOn(runs, 'save');

    await markInterruptedRuns('veronica', runs, clock);

    expect(save.mock.calls[0]?.[0]).toMatchObject({
      status: RunStatus.INTERRUPTED,
      stopReason: RunStopReason.INTERRUPTED,
    });
  });
});
