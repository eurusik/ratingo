import postgres from 'postgres';

import { rowOf } from './cell-value.policy';
import { assertNamedColumns, boundedSelect, type OutputColumn } from './column-projection.policy';
import {
  DB_CLIENT_DEADLINE_SLACK_MS,
  DB_CONNECT_TIMEOUT_SECONDS,
  DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  DB_LOCK_TIMEOUT_MS,
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
import { failureOfQuery, failureOfSchema, isConnectionLoss } from './query-failure.policy';
import { SCHEMA_SQL, toSchemaListing, type SchemaRow } from './schema-listing.mapper';

const SHUTDOWN_GRACE_SECONDS = 5;
const IDLE_CONNECTION_SECONDS = 30;
const DATE_OID = 1082;
const TIMESTAMP_OID = 1114;
const TIMESTAMPTZ_OID = 1184;
const FORCE_EXTENDED_PROTOCOL = { simple: false } as unknown as postgres.UnsafeQueryOptions;

export interface ExplorerConnectionOptions {
  statementTimeoutMs?: number;
}

const rawText = { serialize: (value: unknown) => String(value), parse: (value: string) => value };

const connectionTypes = {
  date: { to: TIMESTAMPTZ_OID, from: [DATE_OID, TIMESTAMP_OID, TIMESTAMPTZ_OID], ...rawText },
};

class ClientDeadlineError extends ExplorerQueryRefusedError {
  constructor() {
    super(QueryRefusal.TIMEOUT, 'the client deadline passed');
    this.name = 'ClientDeadlineError';
  }
}

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

  constructor(
    private readonly createSql: () => postgres.Sql,
    private readonly statementTimeoutMs: number = DB_STATEMENT_TIMEOUT_MS,
  ) {
    this.sql = createSql();
  }

  async schema(): Promise<SchemaListing> {
    try {
      const rows = await this.inRolledBackTransaction(
        async (connection) =>
          (await this.execute(connection, SCHEMA_SQL)) as unknown as SchemaRow[],
      );
      return toSchemaListing(rows);
    } catch (error) {
      throw failureOfSchema(error);
    }
  }

  async query(request: QueryRequest): Promise<QueryRows> {
    try {
      return await this.inRolledBackTransaction(async (connection) => {
        const statement = request.explain
          ? `EXPLAIN (FORMAT TEXT) ${request.sql}`
          : await this.boundedStatement(connection, request);
        const result = await this.execute(connection, statement);
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
    await this.sql.end({ timeout: SHUTDOWN_GRACE_SECONDS });
  }

  private async boundedStatement(
    connection: postgres.ReservedSql,
    request: QueryRequest,
  ): Promise<string> {
    const described = await connection.unsafe(request.sql, [], FORCE_EXTENDED_PROTOCOL).describe();
    const columns: OutputColumn[] = described.columns.map(({ name, type }) => ({ name, type }));
    assertNamedColumns(columns);
    return boundedSelect(columns, request.sql, request.rowLimit);
  }

  private async execute(connection: postgres.ReservedSql, statement: string) {
    const query = connection.unsafe(statement, [], FORCE_EXTENDED_PROTOCOL);
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        query.cancel();
        reject(new ClientDeadlineError());
      }, this.statementTimeoutMs + DB_CLIENT_DEADLINE_SLACK_MS);
    });
    try {
      return await Promise.race([query, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async inRolledBackTransaction<T>(
    work: (connection: postgres.ReservedSql) => Promise<T>,
  ): Promise<T> {
    const connection = await this.sql.reserve();
    let reusable = true;
    try {
      await connection.unsafe('BEGIN READ ONLY');
      await connection.unsafe(this.limits());
      return await work(connection);
    } catch (error) {
      reusable =
        !isConnectionLoss(failureOfQuery(error)) && !(error instanceof ClientDeadlineError);
      throw error;
    } finally {
      if (reusable) reusable = await this.resetSession(connection);
      if (reusable) connection.release();
      else await this.replaceConnection();
    }
  }

  private async resetSession(connection: postgres.ReservedSql): Promise<boolean> {
    try {
      await connection.unsafe('ROLLBACK');
      await connection.unsafe('DISCARD ALL');
      return true;
    } catch {
      return false;
    }
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
