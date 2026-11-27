import { RowList } from '@ratingo/ai-core';

import type { OpsLogger } from '../shared/ops-logger.port';

import { DB_QUERY_ROW_LIMIT, DB_STATEMENT_TIMEOUT_MS, QueryRefusal } from './database.constants';
import {
  ExplorerFailureError,
  ExplorerNotConfiguredError,
  ExplorerQueryRefusedError,
  ExplorerUnavailableError,
  type ExplorerPort,
  type QueryRows,
} from './database.port';
import type { DbQueryInput } from './db-query.input';
import { readOnlyStatement } from './sql-statement.policy';

const TOOL = 'db_query';
const MS_PER_SECOND = 1000;

const EMPTY_NOTE =
  'No row matched. This covers only the tables and columns the database role may read, with soft-deleted rows included unless the query filtered them out. It does not mean the data does not exist elsewhere.';

const ROW_HINT = 'add WHERE, GROUP BY or a smaller LIMIT, or select fewer columns';

const refusalMessage = (refusal: QueryRefusal, detail: string, timeoutMs: number): string => {
  switch (refusal) {
    case QueryRefusal.PRIVATE:
      return `This data is private: the database refuses to show it (${detail}). Do not look for another way to read it. Tell the owner it is private, not that it does not exist.`;
    case QueryRefusal.NOT_FOUND:
      return `No readable table, column or function matches (${detail}). Call db_schema to see what can be read; private tables and columns are not listed there.`;
    case QueryRefusal.INVALID_QUERY:
      return `The database rejected the query (${detail}). Fix the query and try again.`;
    case QueryRefusal.TIMEOUT:
      return `The query was cancelled after ${timeoutMs / MS_PER_SECOND} seconds and returned no rows, not even partial ones. Nothing was changed. Do not state any number from it. Make it cheaper: filter by date or id, select fewer columns, aggregate instead of listing, or call with explain=true to see the plan.`;
    case QueryRefusal.BUSY:
      return `The database is busy (${detail}). Nothing was run. Try again later.`;
    case QueryRefusal.NOT_ALLOWED:
      return `This is not allowed for the read-only database role (${detail}). Do not retry it or look for another way.`;
  }
};

const EXPECTED_REFUSALS: ReadonlySet<QueryRefusal> = new Set([
  QueryRefusal.PRIVATE,
  QueryRefusal.NOT_FOUND,
  QueryRefusal.INVALID_QUERY,
  QueryRefusal.NOT_ALLOWED,
]);

const answerOf = (error: ExplorerQueryRefusedError, timeoutMs: number) => ({
  status: error.refusal,
  message: refusalMessage(error.refusal, error.message, timeoutMs),
});

const logReason = (error: unknown): string => {
  if (error instanceof ExplorerQueryRefusedError) return error.refusal;
  return error instanceof ExplorerFailureError ? error.reason : 'error';
};

const asUnavailable = (error: unknown): unknown =>
  error instanceof ExplorerFailureError ? new ExplorerUnavailableError(TOOL, error.reason) : error;

const omissionOf = (result: QueryRows, shown: number) => {
  const omitted = result.rows.length - shown + (result.hasMoreRows ? 1 : 0);
  if (omitted === 0) return {};
  return {
    omitted,
    ...(result.hasMoreRows ? { omittedIsLowerBound: true } : {}),
    hint: ROW_HINT,
  };
};

export interface DbQueryOptions {
  rowLimit?: number;
  statementTimeoutMs?: number;
}

export class DbQueryExecutor {
  constructor(
    private readonly explorer: ExplorerPort,
    private readonly logger: OpsLogger,
    private readonly options: DbQueryOptions = {},
  ) {}

  private get rowLimit(): number {
    return this.options.rowLimit ?? DB_QUERY_ROW_LIMIT;
  }

  private get statementTimeoutMs(): number {
    return this.options.statementTimeoutMs ?? DB_STATEMENT_TIMEOUT_MS;
  }

  async run(input: DbQueryInput): Promise<unknown> {
    const sql = readOnlyStatement(input.sql);
    const explain = input.explain === true;
    try {
      const result = await this.explorer.query({ sql, explain, rowLimit: this.rowLimit });
      return explain ? this.planOf(result) : this.rowsOf(result);
    } catch (error) {
      this.logFailure(error);
      if (error instanceof ExplorerQueryRefusedError)
        return answerOf(error, this.statementTimeoutMs);
      throw asUnavailable(error);
    }
  }

  private logFailure(error: unknown): void {
    if (error instanceof ExplorerNotConfiguredError) return;
    const message = `db_query failed: ${logReason(error)}`;
    if (error instanceof ExplorerQueryRefusedError && EXPECTED_REFUSALS.has(error.refusal)) {
      this.logger.debug?.(message);
    } else {
      this.logger.warn(message);
    }
  }

  private planOf(result: QueryRows) {
    return {
      plan: result.rows.map((row) => String(Object.values(row)[0] ?? '')),
      note: result.hasMoreRows
        ? `This is only the planner estimate, cut after ${this.rowLimit} lines: the query was not run and no data was read.`
        : 'This is only the planner estimate: the query was not run and no data was read.',
    };
  }

  private rowsOf(result: QueryRows): RowList<Record<string, unknown>> {
    return RowList.of(result.rows, ROW_HINT, (kept) => ({
      columns: result.columns,
      rowLimit: this.rowLimit,
      rows: kept,
      ...omissionOf(result, kept.length),
      ...(result.rows.length === 0 ? { note: EMPTY_NOTE } : {}),
    }));
  }
}
