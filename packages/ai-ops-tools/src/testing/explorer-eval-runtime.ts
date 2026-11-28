import { DbQueryExecutor } from '../database/db-query.executor';
import { DbSchemaExecutor } from '../database/db-schema.executor';
import type { ExplorerPort } from '../database/database.port';
import { PostgresExplorerAdapter } from '../database/postgres.explorer-adapter';
import { UnconfiguredExplorerAdapter } from '../database/unconfigured.explorer-adapter';
import type { OpsExecutors } from '../tools/ops-tools';

import {
  createExplorerTestDatabase,
  type ExplorerTestDatabase,
  type ExplorerTestDatabaseOptions,
} from './explorer-database';
import { seedExplorerFixture } from './explorer-fixture';

const QUIET = { warn: () => undefined };

export type ExplorerExecutors = Pick<OpsExecutors, 'dbSchema' | 'dbQuery'>;

export interface ExplorerExecutorOptions {
  statementTimeoutMs?: number;
}

const executorsOver = (
  port: ExplorerPort,
  { statementTimeoutMs }: ExplorerExecutorOptions = {},
): ExplorerExecutors => {
  const schema = new DbSchemaExecutor(port, QUIET);
  const query = new DbQueryExecutor(port, QUIET, { statementTimeoutMs });
  return { dbSchema: (input) => schema.run(input), dbQuery: (input) => query.run(input) };
};

export const unconfiguredExplorerExecutors = (): ExplorerExecutors =>
  executorsOver(new UnconfiguredExplorerAdapter());

export const missingExplorerDatabaseExecutors = (reason: string): ExplorerExecutors =>
  executorsOver({
    schema: () => Promise.reject(new Error(reason)),
    query: () => Promise.reject(new Error(reason)),
  });

export class ExplorerEvalRuntime {
  private readonly adapters = new Map<number | undefined, PostgresExplorerAdapter>();

  private constructor(private readonly database: ExplorerTestDatabase) {}

  static async start(options: ExplorerTestDatabaseOptions): Promise<ExplorerEvalRuntime> {
    const database = await createExplorerTestDatabase(options);
    await seedExplorerFixture(database.admin, { heavy: true });
    return new ExplorerEvalRuntime(database);
  }

  executors(options: ExplorerExecutorOptions = {}): ExplorerExecutors {
    const { statementTimeoutMs } = options;
    const existing = this.adapters.get(statementTimeoutMs);
    const adapter =
      existing ??
      PostgresExplorerAdapter.connect(
        this.database.explorerUrl,
        statementTimeoutMs === undefined ? {} : { statementTimeoutMs },
      );
    this.adapters.set(statementTimeoutMs, adapter);
    return executorsOver(adapter, options);
  }

  async close(): Promise<void> {
    await Promise.all([...this.adapters.values()].map((adapter) => adapter.close()));
    await this.database.close();
  }
}
