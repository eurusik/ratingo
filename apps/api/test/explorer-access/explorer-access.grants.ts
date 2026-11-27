import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type * as postgres from 'postgres';

import type {
  ExecutableFunction,
  ExplorerGrants,
  PgType,
  ReadableColumn,
} from './explorer-access.guard';

const SQL_DIR = __dirname;

interface ColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
  kind?: string;
  options?: string;
  type_oid?: number;
  links_to_users?: boolean;
}

interface TypeRow {
  type_oid: number;
  type_name: string;
  type_kind: string;
  base_type_oid: number;
  element_type_oid: number;
  type_category: string;
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
  typeOid: row.type_oid,
  linksToUsers: row.links_to_users,
});

const toType = (row: TypeRow): PgType => ({
  oid: row.type_oid,
  name: row.type_name,
  kind: row.type_kind,
  baseOid: row.base_type_oid,
  elementOid: row.element_type_oid,
  category: row.type_category,
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
  const types = await admin.file(join(SQL_DIR, 'type-catalog.sql'));
  return {
    readable: readable.map((row) => toColumn(row as unknown as ColumnRow)),
    direct: direct.map((row) => toColumn(row as unknown as ColumnRow)),
    tableGrants: tableGrants.map((row) => ({
      schema: (row as unknown as TableGrantRow).schema_name,
      table: (row as unknown as TableGrantRow).table_name,
    })),
    functions: functions.map((row) => toFunction(row as unknown as FunctionRow)),
    types: types.map((row) => toType(row as unknown as TypeRow)),
  };
};

export const readSqlFixture = (name: string): string =>
  readFileSync(join(SQL_DIR, 'fixtures', name), 'utf8');
