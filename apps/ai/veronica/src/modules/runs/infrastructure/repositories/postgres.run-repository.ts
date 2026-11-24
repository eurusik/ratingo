import { and, eq, gte, sql } from 'drizzle-orm';

import type { ModelUsage, RunRepository, RunSnapshot, SpendQuery } from '@ratingo/ai-core';
import { RunStatus, RunStopReason, RunTrigger } from '@ratingo/ai-core';

import type { Database } from '../../../../database/database.module';
import { runs } from '../../../../database/schema';

type RunRow = typeof runs.$inferSelect;

const toRow = (run: RunSnapshot): RunRow => ({
  id: run.id,
  agent: run.agent,
  task: run.task ?? null,
  trigger: run.trigger,
  model: run.model,
  status: run.status,
  stopReason: run.stopReason ?? null,
  stopDetail: run.stopDetail ?? null,
  startedAtMs: run.startedAtMs,
  finishedAtMs: run.finishedAtMs ?? null,
  turns: run.turns,
  usage: run.usage,
  costUsd: run.costUsd,
  toolCalls: run.toolCalls,
});

const fromRow = (row: RunRow): RunSnapshot => ({
  id: row.id,
  agent: row.agent,
  ...(row.task === null ? {} : { task: row.task }),
  trigger: row.trigger as RunTrigger,
  model: row.model,
  status: row.status as RunStatus,
  ...(row.stopReason === null ? {} : { stopReason: row.stopReason as RunStopReason }),
  ...(row.stopDetail === null ? {} : { stopDetail: row.stopDetail }),
  startedAtMs: row.startedAtMs,
  ...(row.finishedAtMs === null ? {} : { finishedAtMs: row.finishedAtMs }),
  turns: row.turns,
  usage: row.usage as ModelUsage,
  costUsd: row.costUsd,
  toolCalls: row.toolCalls as Record<string, number>,
});

export class PostgresRunRepository implements RunRepository {
  constructor(private readonly db: Database) {}

  async save(run: RunSnapshot): Promise<void> {
    const row = toRow(run);
    await this.db
      .insert(runs)
      .values(row)
      .onConflictDoUpdate({ target: runs.id, set: { ...row, id: undefined } });
  }

  async findRunning(agent: string): Promise<RunSnapshot[]> {
    const rows = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.agent, agent), eq(runs.status, RunStatus.RUNNING)));
    return rows.map(fromRow);
  }

  async spentUsd(query: SpendQuery): Promise<number> {
    const conditions = [eq(runs.agent, query.agent), gte(runs.startedAtMs, query.sinceMs)];
    if (query.task !== undefined) {
      conditions.push(eq(runs.task, query.task));
    }
    const [row] = await this.db
      .select({ total: sql<number>`coalesce(sum(${runs.costUsd}), 0)` })
      .from(runs)
      .where(and(...conditions));
    return Number(row?.total ?? 0);
  }
}
