import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type * as postgres from 'postgres';

import type { ExecutableFunction, ExplorerGrants, ReadableColumn } from './explorer-access.guard';

const SQL_DIR = __dirname;

interface ColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  kind?: string;
  options?: string;
  type_name?: string;
  type_category?: string;
}

interface TableGrantRow {
  schema_name: string;
  table_name: string;
}

interface FunctionRow {
  schema_name: string;
  signature: string;
  security_definer: boolean;
  system_function: boolean;
}

const toColumn = (row: ColumnRow): ReadableColumn => ({
  schema: row.schema_name,
  table: row.table_name,
  column: row.column_name,
  kind: row.kind,
  options: row.options,
  typeName: row.type_name,
  typeCategory: row.type_category,
});

const toFunction = (row: FunctionRow): ExecutableFunction => ({
  schema: row.schema_name,
  signature: row.signature,
  securityDefiner: row.security_definer,
  systemFunction: row.system_function,
});

export const readExplorerGrants = async (admin: postgres.Sql): Promise<ExplorerGrants> => {
  const readable = await admin.file(join(SQL_DIR, 'readable-columns.sql'));
  const direct = await admin.file(join(SQL_DIR, 'direct-grants.sql'));
  const tableGrants = await admin.file(join(SQL_DIR, 'table-grants.sql'));
  const functions = await admin.file(join(SQL_DIR, 'executable-functions.sql'));
  return {
    readable: readable.map((row) => toColumn(row as unknown as ColumnRow)),
    direct: direct.map((row) => toColumn(row as unknown as ColumnRow)),
    tableGrants: tableGrants.map((row) => ({
      schema: (row as unknown as TableGrantRow).schema_name,
      table: (row as unknown as TableGrantRow).table_name,
    })),
    functions: functions.map((row) => toFunction(row as unknown as FunctionRow)),
  };
};

export const readSqlFixture = (name: string): string =>
  readFileSync(join(SQL_DIR, 'fixtures', name), 'utf8');
