import postgres from 'postgres';

import { rowOf } from './cell-value.policy';
import { assertNamedColumns, boundedSelect } from './column-projection.policy';
import {
  DB_CLIENT_DEADLINE_SLACK_MS,
  DB_CONNECT_TIMEOUT_SECONDS,
  DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  DB_LOCK_TIMEOUT_MS,
  DB_MAX_PENDING_CALLS,
  DB_STATEMENT_TIMEOUT_MS,
  QueryRefusal,
} from './database.constants';
import {
  ExplorerQueryRefusedError,
  type ExplorerPort,
  type QueryRequest,
  type QueryRows,
  type SchemaListing,
} from './database.port';
import { ExplorerSession } from './explorer-session';
import { failureOfQuery, failureOfSchema } from './query-failure.policy';
import { SCHEMA_SQL, toSchemaListing, type SchemaRow } from './schema-listing.mapper';
import { TypeOid } from './type-oid';

const SHUTDOWN_GRACE_SECONDS = 5;
const IDLE_CONNECTION_SECONDS = 30;

export interface ExplorerConnectionOptions {
  statementTimeoutMs?: number;
}

const rawText = { serialize: (value: unknown) => String(value), parse: (value: string) => value };

const connectionTypes = {
  date: {
    to: TypeOid.TIMESTAMPTZ,
    from: [TypeOid.DATE, TypeOid.TIMESTAMP, TypeOid.TIMESTAMPTZ],
    ...rawText,
  },
};

export class PostgresExplorerAdapter implements ExplorerPort {
  static connect(
    explorerDatabaseUrl: string,
    options: ExplorerConnectionOptions = {},
  ): PostgresExplorerAdapter {
    const createSql = (): postgres.Sql =>
      postgres(explorerDatabaseUrl, {
        max: 1,
        prepare: false,
        connect_timeout: DB_CONNECT_TIMEOUT_SECONDS,
        idle_timeout: IDLE_CONNECTION_SECONDS,
        onnotice: () => undefined,
        connection: { application_name: 'ratingo-ai-explorer' },
        types: connectionTypes,
      });
    return new PostgresExplorerAdapter(
      createSql,
      options.statementTimeoutMs ?? DB_STATEMENT_TIMEOUT_MS,
    );
  }

  private sql: postgres.Sql;
  private queue: Promise<unknown> = Promise.resolve();
  private pendingCalls = 0;
  private closed = false;

  constructor(
    private readonly createSql: () => postgres.Sql,
    private readonly statementTimeoutMs: number = DB_STATEMENT_TIMEOUT_MS,
  ) {
    this.sql = createSql();
  }

  async schema(): Promise<SchemaListing> {
    try {
      const rows = await this.inRolledBackTransaction(
        async (session) => (await session.run(SCHEMA_SQL)) as unknown as SchemaRow[],
      );
      return toSchemaListing(rows);
    } catch (error) {
      throw failureOfSchema(error);
    }
  }

  async query(request: QueryRequest): Promise<QueryRows> {
    try {
      return await this.inRolledBackTransaction(async (session) => {
        const statement = request.explain
          ? `EXPLAIN (FORMAT TEXT) ${request.sql}`
          : await this.boundedStatement(session, request);
        const result = await session.run(statement);
        const all = Array.from(result, (row) => rowOf(row));
        return {
          columns: result.columns.map((column) => column.name),
          rows: all.slice(0, request.rowLimit),
          hasMoreRows: all.length > request.rowLimit,
        };
      });
    } catch (error) {
      throw failureOfQuery(error);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.queue;
    await this.sql.end({ timeout: SHUTDOWN_GRACE_SECONDS });
  }

  private async boundedStatement(session: ExplorerSession, request: QueryRequest): Promise<string> {
    const { columns } = await session.describe(request.sql);
    assertNamedColumns(columns);
    return boundedSelect(columns, request.sql, request.rowLimit);
  }

  private inRolledBackTransaction<T>(work: (session: ExplorerSession) => Promise<T>): Promise<T> {
    if (this.closed) {
      throw new ExplorerQueryRefusedError(
        QueryRefusal.BUSY,
        'the database explorer is shutting down',
      );
    }
    if (this.pendingCalls >= DB_MAX_PENDING_CALLS) {
      throw new ExplorerQueryRefusedError(
        QueryRefusal.BUSY,
        'the database explorer is busy with other queries: try again in a moment',
      );
    }
    this.pendingCalls += 1;
    const turn = this.queue.then(
      () => this.withSession(work),
      () => this.withSession(work),
    );
    this.queue = turn.then(
      () => this.leaveQueue(),
      () => this.leaveQueue(),
    );
    return turn;
  }

  private leaveQueue(): void {
    this.pendingCalls -= 1;
  }

  private async withSession<T>(work: (session: ExplorerSession) => Promise<T>): Promise<T> {
    const session = new ExplorerSession(
      await this.sql.reserve(),
      this.statementTimeoutMs + DB_CLIENT_DEADLINE_SLACK_MS,
    );
    try {
      await session.control('BEGIN READ ONLY');
      await session.control(this.limits());
      return await work(session);
    } finally {
      await this.finish(session);
    }
  }

  private async finish(session: ExplorerSession): Promise<void> {
    if (session.reusable) await session.reset();
    if (session.reusable) session.release();
    else await this.replaceConnection();
  }

  private async replaceConnection(): Promise<void> {
    const broken = this.sql;
    this.sql = this.createSql();
    await broken.end({ timeout: 0 }).catch(() => undefined);
  }

  private limits(): string {
    return `SET LOCAL statement_timeout = ${this.statementTimeoutMs};
      SET LOCAL lock_timeout = ${DB_LOCK_TIMEOUT_MS};
      SET LOCAL idle_in_transaction_session_timeout = ${DB_IDLE_IN_TRANSACTION_TIMEOUT_MS};
      SET LOCAL work_mem = '16MB';
      SET LOCAL search_path = public, pg_catalog;
      SET LOCAL TimeZone = 'UTC'`;
  }
}
