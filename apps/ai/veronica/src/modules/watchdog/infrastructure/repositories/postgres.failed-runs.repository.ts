import { and, eq, gte, sql } from 'drizzle-orm';

import { RunStatus } from '@ratingo/ai-core';

import type { Database } from '../../../../database/database.module';
import { runs } from '../../../../database/schema';
import type { FailedRunsPort } from '../../domain/ports/watchdog.ports';

export class PostgresFailedRunsRepository implements FailedRunsPort {
  constructor(private readonly db: Database) {}

  async countFailedSince(agent: string, sinceMs: number): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(runs)
      .where(
        and(
          eq(runs.agent, agent),
          eq(runs.status, RunStatus.FAILED),
          gte(runs.startedAtMs, sinceMs),
        ),
      );
    return Number(row?.total ?? 0);
  }
}
