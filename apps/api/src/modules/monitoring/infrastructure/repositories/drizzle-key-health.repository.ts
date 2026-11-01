import { Inject, Injectable, Logger } from '@nestjs/common';

import { desc, eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';

import { type MonitoredProvider } from '../../domain/constants/monitored-provider.const';
import {
  type KeyHealthSnapshot,
  type SaveKeyHealthInput,
} from '../../domain/entities/key-health-snapshot.entity';
import { type KeyHealthRepository } from '../../domain/repositories/key-health.repository';

type KeyHealthRow = typeof schema.keyHealthChecks.$inferSelect;

@Injectable()
export class DrizzleKeyHealthRepository implements KeyHealthRepository {
  private readonly logger = new Logger(DrizzleKeyHealthRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async save(snapshot: SaveKeyHealthInput): Promise<void> {
    return withDbError(
      'save key health snapshot',
      this.logger,
      async () => {
        await this.db.insert(schema.keyHealthChecks).values({
          provider: snapshot.provider,
          status: snapshot.status,
          statusCode: snapshot.statusCode,
          latencyMs: snapshot.latencyMs,
          detail: snapshot.detail,
          quotaRemaining: snapshot.quotaRemaining,
          quotaLimit: snapshot.quotaLimit,
        });
      },
      { provider: snapshot.provider },
    );
  }

  async findLatestPerProvider(): Promise<KeyHealthSnapshot[]> {
    return withDbError('list latest key health', this.logger, async () => {
      const rows = await this.db
        .selectDistinctOn([schema.keyHealthChecks.provider])
        .from(schema.keyHealthChecks)
        .orderBy(schema.keyHealthChecks.provider, desc(schema.keyHealthChecks.checkedAt));

      return rows.map((row) => this.toSnapshot(row));
    });
  }

  async findHistory(provider: MonitoredProvider, limit: number): Promise<KeyHealthSnapshot[]> {
    return withDbError(
      'list key health history',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(schema.keyHealthChecks)
          .where(eq(schema.keyHealthChecks.provider, provider))
          .orderBy(desc(schema.keyHealthChecks.checkedAt))
          .limit(limit);

        return rows.map((row) => this.toSnapshot(row));
      },
      { provider },
    );
  }

  private toSnapshot(row: KeyHealthRow): KeyHealthSnapshot {
    return {
      provider: row.provider,
      status: row.status,
      statusCode: row.statusCode,
      latencyMs: row.latencyMs,
      detail: row.detail,
      quotaRemaining: row.quotaRemaining,
      quotaLimit: row.quotaLimit,
      checkedAt: row.checkedAt,
    };
  }
}
