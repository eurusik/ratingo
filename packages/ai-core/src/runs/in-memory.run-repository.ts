import type { RunSnapshot } from './run';
import { RunStatus } from './run';
import type { RunRepository, SpendQuery } from './run.repository';

const RETENTION_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const IN_MEMORY_RETENTION_MS = RETENTION_DAYS * MS_PER_DAY;

export class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<string, RunSnapshot>();

  async save(run: RunSnapshot): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
    this.evictFinishedBefore((run.finishedAtMs ?? run.startedAtMs) - IN_MEMORY_RETENTION_MS);
  }

  async findRunning(agent: string): Promise<RunSnapshot[]> {
    return this.all()
      .filter((run) => run.agent === agent && run.status === RunStatus.RUNNING)
      .map((run) => structuredClone(run));
  }

  async spentUsd(query: SpendQuery): Promise<number> {
    return this.all()
      .filter(
        (run) =>
          run.agent === query.agent &&
          run.startedAtMs >= query.sinceMs &&
          (query.task === undefined || run.task === query.task),
      )
      .reduce((sum, run) => sum + run.costUsd, 0);
  }

  private all(): RunSnapshot[] {
    return [...this.runs.values()];
  }

  private evictFinishedBefore(cutoffMs: number): void {
    for (const [id, run] of this.runs) {
      if (run.finishedAtMs !== undefined && run.finishedAtMs < cutoffMs) {
        this.runs.delete(id);
      }
    }
  }
}
