import { RowList } from '@ratingo/ai-core';

import { InvalidOpsInputError } from '../shared/invalid-ops-input.error';
import type { OpsLogger } from '../shared/ops-logger.port';

import { DB_TABLE_FILTER_MAX_CHARS } from './database.constants';
import {
  ExplorerFailureError,
  ExplorerNotConfiguredError,
  ExplorerUnavailableError,
  type ExplorerPort,
  type SchemaColumn,
  type SchemaTable,
} from './database.port';
import type { DbSchemaInput } from './db-schema.input';

const TOOL = 'db_schema';
const TABLE_FILTER = /^[A-Za-z0-9_]+$/;

const CAVEATS =
  'Row counts are planner estimates, not exact counts. A column that exists but is private is not listed; privateColumns only counts them. privateTables are whole tables the database does not let you read: say that data is private, never that it does not exist.';

const compactColumn = (column: SchemaColumn): string =>
  column.enumValues === undefined ? column.name : `${column.name}{${column.enumValues.join('|')}}`;

const compactRow = (table: SchemaTable): Record<string, unknown> => ({
  table: table.name,
  ...(table.kind === 'view' ? { kind: 'view' } : {}),
  rowsEstimate: table.rowEstimate,
  columns: table.columns.map(compactColumn).join(', '),
  ...(table.privateColumnCount > 0 ? { privateColumns: table.privateColumnCount } : {}),
});

const detailedRow = (table: SchemaTable): Record<string, unknown> => ({
  table: table.name,
  ...(table.kind === 'view' ? { kind: 'view' } : {}),
  rowsEstimate: table.rowEstimate,
  columns: table.columns.map((column) => ({
    name: column.name,
    type: column.type,
    ...(column.enumValues === undefined ? {} : { values: column.enumValues }),
  })),
  ...(table.privateColumnCount > 0 ? { privateColumns: table.privateColumnCount } : {}),
});

const unavailable = (error: unknown): unknown => {
  if (error instanceof ExplorerFailureError) {
    return new ExplorerUnavailableError(TOOL, error.reason);
  }
  return error;
};

export class DbSchemaExecutor {
  constructor(
    private readonly explorer: ExplorerPort,
    private readonly logger: OpsLogger,
  ) {}

  async run(input: DbSchemaInput): Promise<unknown> {
    const filter = this.parseFilter(input.table);
    const listing = await this.fetch();
    const wanted = listing.tables.filter(
      (table) => filter === undefined || table.name.toLowerCase().includes(filter),
    );
    const rows = wanted.map(filter === undefined ? compactRow : detailedRow);
    const hint =
      filter === undefined
        ? 'pass table=<part of a table name> to list only those tables with column types'
        : 'pass a more specific table name';
    return RowList.of(rows, hint, (kept, omission) => ({
      ...(filter === undefined ? {} : { tableFilter: filter }),
      tables: kept,
      ...(filter === undefined && listing.privateTables.length > 0
        ? { privateTables: listing.privateTables }
        : {}),
      ...(rows.length === 0 ? { note: this.noMatchNote(filter) } : {}),
      howToRead: CAVEATS,
      ...omission,
    }));
  }

  private parseFilter(table: string | undefined): string | undefined {
    if (table === undefined || table === '') return undefined;
    if (table.length > DB_TABLE_FILTER_MAX_CHARS || !TABLE_FILTER.test(table)) {
      throw new InvalidOpsInputError('table must be part of a table name such as saved or media');
    }
    return table.toLowerCase();
  }

  private noMatchNote(filter: string | undefined): string {
    return filter === undefined
      ? 'The database role can read no table.'
      : `No readable table has "${filter}" in its name. A private table is not listed either; call db_schema without table to see every readable table.`;
  }

  private async fetch() {
    try {
      return await this.explorer.schema();
    } catch (error) {
      if (!(error instanceof ExplorerNotConfiguredError)) {
        this.logger.warn(
          `db_schema failed: ${error instanceof ExplorerFailureError ? error.reason : 'error'}`,
        );
      }
      throw unavailable(error);
    }
  }
}
