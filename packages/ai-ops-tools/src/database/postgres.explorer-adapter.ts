import postgres from 'postgres';

import {
  DB_CONNECT_TIMEOUT_SECONDS,
  DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
  DB_LOCK_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS,
} from './database.constants';
import type { ExplorerPort, QueryRequest, QueryRows, SchemaListing } from './database.port';
import { rowOf } from './cell-value.policy';
import { failureOfQuery, failureOfSchema } from './query-failure.policy';
import { SCHEMA_SQL, toSchemaListing, type SchemaRow } from './schema-listing.mapper';

const SHUTDOWN_GRACE_SECONDS = 5;
const IDLE_CONNECTION_SECONDS = 30;
const BIGINT_OID = 20;
const NUMERIC_OID = 1700;
const DATE_OID = 1082;
const TIMESTAMP_OID = 1114;
const TIMESTAMPTZ_OID = 1184;

export interface ExplorerConnectionOptions {
  statementTimeoutMs?: number;
}

const rawText = { serialize: (value: unknown) => String(value), parse: (value: string) => value };

const connectionTypes = {
  bigint: { to: BIGINT_OID, from: [BIGINT_OID], serialize: String, parse: Number },
  numeric: { to: NUMERIC_OID, from: [NUMERIC_OID], serialize: String, parse: Number },
  date: { to: TIMESTAMPTZ_OID, from: [DATE_OID, TIMESTAMP_OID, TIMESTAMPTZ_OID], ...rawText },
};

export class PostgresExplorerAdapter implements ExplorerPort {
  static connect(
    explorerDatabaseUrl: string,
    options: ExplorerConnectionOptions = {},
  ): PostgresExplorerAdapter {
    return new PostgresExplorerAdapter(
      postgres(explorerDatabaseUrl, {
        max: 1,
        connect_timeout: DB_CONNECT_TIMEOUT_SECONDS,
        idle_timeout: IDLE_CONNECTION_SECONDS,
        onnotice: () => undefined,
        connection: { application_name: 'ratingo-ai-explorer' },
        types: connectionTypes,
      }),
      options.statementTimeoutMs ?? DB_STATEMENT_TIMEOUT_MS,
    );
  }

  constructor(
    private readonly sql: postgres.Sql,
    private readonly statementTimeoutMs: number = DB_STATEMENT_TIMEOUT_MS,
  ) {}

  async schema(): Promise<SchemaListing> {
    try {
      const rows = await this.inReadOnlyTransaction(
        async (transaction) => (await transaction.unsafe(SCHEMA_SQL)) as unknown as SchemaRow[],
      );
      return toSchemaListing(rows);
    } catch (error) {
      throw failureOfSchema(error);
    }
  }

  async query(request: QueryRequest): Promise<QueryRows> {
    try {
      return await this.inReadOnlyTransaction(async (transaction) => {
        const statement = request.explain
          ? `EXPLAIN (FORMAT TEXT) ${request.sql}`
          : `SELECT * FROM (${request.sql}) AS explorer_result LIMIT ${request.rowLimit + 1}`;
        const result = await transaction.unsafe(statement);
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

  private inReadOnlyTransaction<T>(
    work: (transaction: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> {
    return this.sql.begin('read only', async (transaction) => {
      await transaction.unsafe(
        `SET LOCAL statement_timeout = ${this.statementTimeoutMs};
         SET LOCAL lock_timeout = ${DB_LOCK_TIMEOUT_MS};
         SET LOCAL idle_in_transaction_session_timeout = ${DB_IDLE_IN_TRANSACTION_TIMEOUT_MS};
         SET LOCAL search_path = public, pg_catalog;
         SET LOCAL TimeZone = 'UTC'`,
      );
      await transaction.unsafe('SELECT pg_advisory_unlock_all()');
      return work(transaction);
    }) as Promise<T>;
  }
}
