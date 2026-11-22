import type { ClockPort } from '../clock/clock.port';
import { Run } from './run';
import type { RunRepository } from './run.repository';

export async function markInterruptedRuns(
  agent: string,
  runs: RunRepository,
  clock: ClockPort,
): Promise<number> {
  const stale = await runs.findRunning(agent);
  for (const snapshot of stale) {
    const run = Run.restore(snapshot);
    run.markInterrupted(clock);
    await runs.save(run.snapshot());
  }
  return stale.length;
}
