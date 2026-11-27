import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type * as postgres from 'postgres';

import {
  ALLOWED_SENSITIVE_NAMES,
  CLOSED_COLUMNS,
  PRIVATE_TABLES,
  WHOLE_TABLE,
} from './explorer-access.rules';
import { sensitivePatternIn } from './sensitive-columns';

export interface ReadableColumn {
  schema: string;
  table: string;
  column: string;
}

export interface TableGrant {
  schema: string;
  table: string;
}

export interface ExplorerGrants {
  readable: readonly ReadableColumn[];
  direct: readonly ReadableColumn[];
  tableGrants?: readonly TableGrant[];
}

export const ViolationKind = {
  PRIVATE_TABLE_READABLE: 'private_table_readable',
  CLOSED_COLUMN_READABLE: 'closed_column_readable',
  SENSITIVE_COLUMN_READABLE: 'sensitive_column_readable',
  SENSITIVE_TABLE_READABLE: 'sensitive_table_readable',
  READABLE_WITHOUT_DIRECT_GRANT: 'readable_without_direct_grant',
  TABLE_GRANT_ON_PROTECTED_TABLE: 'table_grant_on_protected_table',
  STALE_ALLOW_LIST_ENTRY: 'stale_allow_list_entry',
} as const;
export type ViolationKind = (typeof ViolationKind)[keyof typeof ViolationKind];

export interface Violation {
  kind: ViolationKind;
  target: string;
  detail: string;
}

const SQL_DIR = __dirname;

const qualified = (item: ReadableColumn): string => `${item.schema}.${item.table}.${item.column}`;

const sameColumn = (left: ReadableColumn, right: ReadableColumn): boolean =>
  left.schema === right.schema && left.table === right.table && left.column === right.column;

const isAllowed = (table: string, column: string): boolean =>
  ALLOWED_SENSITIVE_NAMES.some(
    (entry) => entry.table === table && (entry.column === column || entry.column === WHOLE_TABLE),
  );

const privateTableViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  PRIVATE_TABLES.flatMap((table) => {
    const open = readable.filter((item) => item.table === table);
    return open.length === 0
      ? []
      : [
          {
            kind: ViolationKind.PRIVATE_TABLE_READABLE,
            target: table,
            detail: `${open.length} column(s) readable: ${open.map((item) => item.column).join(', ')}`,
          },
        ];
  });

const closedColumnViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  CLOSED_COLUMNS.flatMap(({ table, columns }) =>
    readable
      .filter((item) => item.table === table && columns.includes(item.column))
      .map((item) => ({
        kind: ViolationKind.CLOSED_COLUMN_READABLE,
        target: qualified(item),
        detail: 'this column is on the closed list',
      })),
  );

const sensitiveTableViolations = (readable: readonly ReadableColumn[]): Violation[] => {
  const tables = new Set(readable.map((item) => item.table));
  return [...tables].flatMap((table) => {
    const pattern = sensitivePatternIn(table);
    return pattern === null || isAllowed(table, WHOLE_TABLE)
      ? []
      : [
          {
            kind: ViolationKind.SENSITIVE_TABLE_READABLE,
            target: table,
            detail: `table name matches "${pattern}" and is not on the allow-list`,
          },
        ];
  });
};

const sensitiveColumnViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  readable.flatMap((item) => {
    const pattern = sensitivePatternIn(item.column);
    return pattern === null || isAllowed(item.table, item.column)
      ? []
      : [
          {
            kind: ViolationKind.SENSITIVE_COLUMN_READABLE,
            target: qualified(item),
            detail: `column name matches "${pattern}" and is not on the allow-list`,
          },
        ];
  });

const withoutDirectGrantViolations = (grants: ExplorerGrants): Violation[] =>
  grants.readable
    .filter((item) => !grants.direct.some((grant) => sameColumn(grant, item)))
    .map((item) => ({
      kind: ViolationKind.READABLE_WITHOUT_DIRECT_GRANT,
      target: qualified(item),
      detail: 'readable through PUBLIC or another role, not through a grant to ai_explorer',
    }));

const protectedTables = new Set([...PRIVATE_TABLES, ...CLOSED_COLUMNS.map(({ table }) => table)]);

const tableGrantViolations = (grants: ExplorerGrants): Violation[] =>
  (grants.tableGrants ?? [])
    .filter((grant) => protectedTables.has(grant.table))
    .map((grant) => ({
      kind: ViolationKind.TABLE_GRANT_ON_PROTECTED_TABLE,
      target: `${grant.schema}.${grant.table}`,
      detail: 'a table-wide SELECT grant opens every column; grant the safe columns instead',
    }));

const staleAllowListViolations = (readable: readonly ReadableColumn[]): Violation[] =>
  ALLOWED_SENSITIVE_NAMES.filter(
    (entry) =>
      !readable.some(
        (item) =>
          item.table === entry.table &&
          (entry.column === WHOLE_TABLE || item.column === entry.column),
      ),
  ).map((entry) => ({
    kind: ViolationKind.STALE_ALLOW_LIST_ENTRY,
    target: `${entry.table}.${entry.column}`,
    detail: 'allow-list entry matches nothing the role can read; remove it',
  }));

export const findViolations = (grants: ExplorerGrants): Violation[] => [
  ...privateTableViolations(grants.readable),
  ...closedColumnViolations(grants.readable),
  ...sensitiveTableViolations(grants.readable),
  ...sensitiveColumnViolations(grants.readable),
  ...withoutDirectGrantViolations(grants),
  ...tableGrantViolations(grants),
  ...staleAllowListViolations(grants.readable),
];

export const describeViolations = (violations: readonly Violation[]): string =>
  violations.map((item) => `${item.kind}: ${item.target} (${item.detail})`).join('\n');

interface TableGrantRow {
  schema_name: string;
  table_name: string;
}

interface ColumnRow {
  schema_name: string;
  table_name: string;
  column_name: string;
}

const toColumn = (row: ColumnRow): ReadableColumn => ({
  schema: row.schema_name,
  table: row.table_name,
  column: row.column_name,
});

export const readExplorerGrants = async (admin: postgres.Sql): Promise<ExplorerGrants> => {
  const readable = await admin.file(join(SQL_DIR, 'readable-columns.sql'));
  const direct = await admin.file(join(SQL_DIR, 'direct-grants.sql'));
  const tableGrants = await admin.file(join(SQL_DIR, 'table-grants.sql'));
  return {
    readable: readable.map((row) => toColumn(row as unknown as ColumnRow)),
    direct: direct.map((row) => toColumn(row as unknown as ColumnRow)),
    tableGrants: tableGrants.map((row) => ({
      schema: (row as unknown as TableGrantRow).schema_name,
      table: (row as unknown as TableGrantRow).table_name,
    })),
  };
};

export const readSqlFixture = (name: string): string =>
  readFileSync(join(SQL_DIR, 'fixtures', name), 'utf8');
